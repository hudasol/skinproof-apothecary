import type { MakeupTaskEffects } from '../../domain/tryon';
import type { CommonRequest, MakeupProvider, MakeupSuccess, ProviderFailure } from '../types';
import { Fail, YouCamClient, type Diagnostics, type YouCamOptions } from './client';
import { extractMakeupResultUrl, shapeOf } from './schemas';

/**
 * YouCam AI Makeup Virtual Try-On adapter (s2s v2.0, effects v1.0).
 * Same chain TryOn verified live: File API → upload → task → poll → download.
 */

const PATH = '/s2s/v2.0/task/makeup-vto';
const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;

export class YouCamMakeup implements MakeupProvider {
  readonly mode = 'live' as const;
  readonly label = 'YouCam AI Makeup Virtual Try-On (s2s v2.0, effects v1.0)';
  private readonly client: YouCamClient;

  constructor(opts: YouCamOptions | YouCamClient) {
    this.client = opts instanceof YouCamClient ? opts : new YouCamClient(opts);
  }

  async render(req: CommonRequest & { effects: MakeupTaskEffects }): Promise<MakeupSuccess | ProviderFailure> {
    const d: Diagnostics = { provider: 'youcam', endpoint: PATH };
    let taskId: string | null = null;
    const started = this.client.now();
    try {
      req.onPhase?.('submitting', {});
      const fileId = await this.client.uploadImage(req.image, d, req.signal);
      taskId = await this.client.startTask(PATH, { src_file_id: fileId, ...req.effects }, d, req.signal);
      req.onPhase?.('processing', { taskId });
      const status = await this.client.pollUntilDone(PATH, taskId, d, req.signal);
      const extracted = extractMakeupResultUrl(status.data.results);
      if (!extracted) {
        d.unexpectedResultsShape = shapeOf(status.data.results);
        throw new Fail({ code: 'missing_result_url', message: 'The service reported success but returned no image.', guidance: 'Try again.', retryable: true });
      }
      d.resultShape = extracted.shape;
      req.onPhase?.('downloading', { taskId });
      const file = await this.client.download(extracted.url, MAX_OUTPUT_BYTES, d, 'output', req.signal);
      const latencyMs = this.client.now() - started;
      d.totalMs = latencyMs;
      return { ok: true, output: file.data, taskId, latencyMs, diagnostics: d };
    } catch (err) {
      d.totalMs = this.client.now() - started;
      return this.client.toFailure(err, taskId, d, req.signal);
    }
  }
}
