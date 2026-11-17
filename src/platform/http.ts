// HTTP for catalogs and cover images, with fetch. Image servers that send no
// CORS headers can be reached through the CORS proxy set in Settings
// (src/catalog/cover.ts).

export interface HttpResult<T> {
  ok: boolean;
  status: number;
  data: T;
  /** The response's content type, lower-cased. */
  type: string;
}

const TIMEOUT_MS = 20_000;

export async function getJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<HttpResult<T | null>> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = res.ok ? ((await res.json()) as T) : null;
  return { ok: res.ok, status: res.status, data, type: (res.headers.get('content-type') ?? '').toLowerCase() };
}

export async function getBytes(url: string): Promise<HttpResult<Uint8Array>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
  return { ok: res.ok, status: res.status, data, type: (res.headers.get('content-type') ?? '').toLowerCase() };
}
