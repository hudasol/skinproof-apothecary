import type { z } from 'zod';
import type { ProviderFailure, ProviderImage } from '../types';
import {
  CreditResponseSchema,
  ENGINE_ERRORS,
  ErrorBodySchema,
  FileCreateResponseSchema,
  SUBMIT_ERRORS,
  TaskCreateResponseSchema,
  TaskStatusResponseSchema,
  shapeOf,
  type TaskStatusResponse,
} from './schemas';

/**
 * Shared YouCam S2S client: File API upload, task start, polling and result
 * download. Ported from TryOn's live-verified makeup adapter and generalised
 * so Skin Analysis and Makeup VTO share one implementation.
 *
 * Secrets: the API key only ever goes into the Authorization header of
 * requests to the configured base URL. Signed upload and download URLs are
 * never logged or stored.
 */

export type YouCamOptions = {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
  pollIntervalMs?: number;
  taskTimeoutMs?: number;
  requestTimeoutMs?: number;
  maxRateLimitRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type Diagnostics = Record<string, unknown>;

/** A failure with a safe message, thrown inside the adapters and turned into a ProviderFailure. */
export class Fail extends Error {
  constructor(readonly failure: Omit<ProviderFailure, 'ok' | 'taskId' | 'diagnostics'>) {
    super(failure.message);
  }
}

const NETWORK_GUIDANCE = 'Check your connection and try again. Nothing was charged for an unfinished task.';

export class YouCamClient {
  private readonly fetchImpl: typeof fetch;
  readonly pollIntervalMs: number;
  readonly taskTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly maxRateLimitRetries: number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;

  constructor(private readonly opts: YouCamOptions) {
    this.fetchImpl = opts.fetch ?? fetch;
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
    this.taskTimeoutMs = opts.taskTimeoutMs ?? 120_000;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 30_000;
    this.maxRateLimitRetries = opts.maxRateLimitRetries ?? 3;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? Date.now;
  }

  /** Map anything thrown inside an adapter to a ProviderFailure. */
  toFailure(err: unknown, taskId: string | null, diagnostics: Diagnostics, signal?: AbortSignal): ProviderFailure {
    if (err instanceof Fail) return { ok: false, ...err.failure, taskId, diagnostics };
    const aborted = signal?.aborted || (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError'));
    return {
      ok: false,
      code: aborted ? 'aborted' : 'network_error',
      message: aborted ? 'The request took too long and was stopped.' : 'Could not reach the YouCam service.',
      guidance: NETWORK_GUIDANCE,
      retryable: true,
      taskId,
      diagnostics,
    };
  }

  /** Remaining units on the account (GET /s2s/v1.0/client/credit). Free. */
  async getCredits(): Promise<{ total: number; entries: { type: string; amount: number; expiry: number | null }[] }> {
    const res = await this.api('GET', '/s2s/v1.0/client/credit');
    const body = await this.parse(res, CreditResponseSchema, 'credit');
    const entries = body.results.map((r) => ({ type: r.type, amount: r.amount_dec ?? r.amount ?? 0, expiry: r.expiry ?? null }));
    return { total: entries.reduce((s, e) => s + e.amount, 0), entries };
  }

  /** POST /s2s/v2.0/file, then PUT the bytes to the presigned URL. Returns the file id. */
  async uploadImage(image: ProviderImage, d: Diagnostics, signal?: AbortSignal): Promise<string> {
    const res = await this.api('POST', '/s2s/v2.0/file', {
      files: [{ content_type: image.mimeType, file_name: image.fileName, file_size: image.data.byteLength }],
    }, signal);
    d.fileApiStatus = res.status;
    const body = await this.parse(res, FileCreateResponseSchema, 'file', d);
    const file = body.data.files[0]!;
    const upload = file.requests[0]!;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(upload.headers ?? {})) {
      // fetch computes Content-Length itself; a hand-set value is rejected by undici.
      if (k.toLowerCase() !== 'content-length') headers[k] = String(v);
    }
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = image.mimeType;
    const method = (upload.method ?? 'PUT').toUpperCase();
    const put = await this.fetchImpl(upload.url, { method, headers, body: new Uint8Array(image.data), signal: this.timeoutSignal(signal) });
    d.uploadStatus = put.status;
    if (!put.ok) {
      throw new Fail({
        code: `upload_http_${put.status}`,
        message: `Uploading the photo to YouCam storage failed (HTTP ${put.status}).`,
        guidance: put.status >= 500 ? 'Try again in a minute.' : null,
        retryable: put.status >= 500,
      });
    }
    return file.file_id;
  }

  async startTask(path: string, body: unknown, d: Diagnostics, signal?: AbortSignal): Promise<string> {
    const res = await this.api('POST', path, body, signal);
    d.submitStatus = res.status;
    const parsed = await this.parse(res, TaskCreateResponseSchema, 'task', d);
    return parsed.data.task_id;
  }

  /** Poll until success (returns the status body) or error/timeout (throws Fail). */
  async pollUntilDone(path: string, taskId: string, d: Diagnostics, signal?: AbortSignal): Promise<TaskStatusResponse> {
    const deadline = this.now() + this.taskTimeoutMs;
    let polls = 0;
    const seen = new Set<string>();
    while (true) {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      const res = await this.api('GET', `${path}/${encodeURIComponent(taskId)}`, undefined, signal);
      polls++;
      d.polls = polls;
      const body = await this.parse(res, TaskStatusResponseSchema, 'status', d);
      const status = body.data.task_status;
      seen.add(status);
      d.statusesSeen = [...seen];
      if (status === 'success') return body;
      if (status === 'error') {
        const code = body.data.error ?? body.data.failure_reason ?? 'unknown_engine_error';
        d.engineError = code;
        const help = ENGINE_ERRORS[code];
        throw new Fail({
          code,
          message: help?.message ?? 'The service could not process this photo.',
          guidance: help?.guidance ?? 'Try another photo.',
          retryable: help?.retryable ?? false,
        });
      }
      if (this.now() >= deadline) {
        throw new Fail({
          code: 'task_timeout',
          message: `The service did not finish within ${Math.round(this.taskTimeoutMs / 1000)} seconds.`,
          guidance: 'Try again. Unfinished tasks are not charged.',
          retryable: true,
        });
      }
      await this.sleep(this.pollIntervalMs);
    }
  }

  /** Download a signed result URL (no Authorization header). */
  async download(url: string, maxBytes: number, d: Diagnostics, key: string, signal?: AbortSignal): Promise<{ data: Buffer; contentType: string | null }> {
    if (!/^https:\/\//.test(url)) {
      throw new Fail({ code: 'result_url_not_https', message: 'The service returned an unexpected result address.', guidance: null, retryable: false });
    }
    const res = await this.fetchImpl(url, { signal: this.timeoutSignal(signal) });
    d[`${key}Status`] = res.status;
    if (!res.ok) {
      throw new Fail({ code: `download_http_${res.status}`, message: `Downloading the result failed (HTTP ${res.status}).`, guidance: res.status >= 500 ? 'Try again.' : null, retryable: res.status >= 500 });
    }
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > maxBytes) throw new Fail({ code: 'output_too_large', message: 'The result file is unexpectedly large.', guidance: null, retryable: false });
    const data = Buffer.from(await res.arrayBuffer());
    if (data.byteLength === 0 || data.byteLength > maxBytes) {
      throw new Fail({ code: 'output_size', message: 'The result file was empty or too large.', guidance: null, retryable: false });
    }
    d[`${key}Bytes`] = data.byteLength;
    return { data, contentType: res.headers.get('content-type') };
  }

  /** Authenticated JSON call with 429 back-off. */
  async api(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(`${this.opts.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: this.timeoutSignal(signal),
      });
      if (res.status !== 429) return res;
      if (attempt >= this.maxRateLimitRetries) {
        throw new Fail({ code: 'http_429', message: 'The YouCam service is busy right now.', guidance: 'Wait a moment and try again.', retryable: true });
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
    }
  }

  async parse<S extends z.ZodType>(res: Response, schema: S, step: string, d?: Diagnostics): Promise<z.output<S>> {
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw this.httpFailure(res.status, undefined, step, 'The response was not JSON.');
    }
    if (!res.ok) {
      const err = ErrorBodySchema.safeParse(json);
      if (d) d[`${step}ErrorCode`] = err.success ? (err.data.error_code ?? null) : null;
      throw this.httpFailure(res.status, err.success ? err.data.error_code : undefined, step);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      // Field names and types only, never values.
      if (d) d.unexpectedShape = { step, shape: shapeOf(json), issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.code}`) };
      throw new Fail({ code: `unexpected_${step}_shape`, message: `The ${step} response did not match the documented contract.`, guidance: null, retryable: false });
    }
    return parsed.data;
  }

  private httpFailure(status: number, errorCode: string | undefined, step: string, extra?: string): Fail {
    const known = errorCode ? SUBMIT_ERRORS[errorCode] : undefined;
    return new Fail({
      code: errorCode ?? `http_${status}`,
      message: known?.message ?? `The YouCam ${step} request failed (HTTP ${status}).${extra ? ` ${extra}` : ''}`,
      guidance: known?.guidance ?? (status >= 500 ? 'Try again in a minute.' : null),
      retryable: known?.retryable ?? status >= 500,
    });
  }

  private timeoutSignal(outer?: AbortSignal): AbortSignal {
    const t = AbortSignal.timeout(this.requestTimeoutMs);
    return outer ? AbortSignal.any([outer, t]) : t;
  }
}
