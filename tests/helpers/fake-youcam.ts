/**
 * A scripted stand-in for fetch, for contract tests. Responses are shaped like
 * the examples in the official docs. No network, no units.
 */

export const BASE = 'https://yce-api-01.makeupar.com';
export const UPLOAD = 'https://upload.example.com/presigned?sig=SECRET_SIGNATURE';
export const KEY = 'test-key-not-real';
export const TASK_ID = 'grH0CvsgXuAIHLUzD0V1Ol34hoet3R1tvdbtiVHrDb6_UqCLKIejAIajwxrhOAfe';

export type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };
export type Route = (call: Call) => Response | undefined;

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function mockFetch(routes: Route[]) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    let body: unknown = init?.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const call = { method: init?.method ?? 'GET', url, headers, body };
    calls.push(call);
    for (const r of routes) {
      const res = r(call);
      if (res) return res;
    }
    throw new Error(`Unmocked ${call.method} ${url}`);
  }) as typeof fetch;
  return { impl, calls };
}

export const fileOk: Route = (c) =>
  c.url === `${BASE}/s2s/v2.0/file`
    ? json(200, {
        status: 200,
        data: {
          files: [
            {
              content_type: 'image/jpeg',
              file_name: 'p.jpg',
              file_id: 'SaGaqpDgKwFrVBgMpQMA3HY0LeqdT9/13W5TOD8/u/FfjK3xgCQ+hRt9MJXBFaud',
              requests: [{ url: UPLOAD, method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'Content-Length': 4 } }],
            },
          ],
        },
      })
    : undefined;

export const uploadOk: Route = (c) => (c.url === UPLOAD ? new Response(null, { status: 200 }) : undefined);

export function taskOk(path: string): Route {
  return (c) => (c.url === `${BASE}${path}` && c.method === 'POST' ? json(200, { status: 200, data: { task_id: TASK_ID } }) : undefined);
}

export function pollSequence(path: string, ...bodies: unknown[]): Route {
  let i = 0;
  return (c) => {
    if (c.method !== 'GET' || !c.url.startsWith(`${BASE}${path}/`)) return undefined;
    const body = bodies[Math.min(i, bodies.length - 1)];
    i++;
    return json(200, body);
  };
}

export function binary(url: string, bytes: Uint8Array, contentType: string): Route {
  return (c) => (c.url === url ? new Response(bytes, { status: 200, headers: { 'content-type': contentType } }) : undefined);
}

export const fastClock = { pollIntervalMs: 1, sleep: async () => {} };
