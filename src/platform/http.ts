// HTTP for catalogs and cover images. In the app requests go through
// Capacitor's native HTTP, so image servers that send no CORS headers still
// answer; in a browser they use fetch.

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { base64ToBytes } from '../lib/base64';

export interface HttpResult<T> {
  ok: boolean;
  status: number;
  data: T;
  /** The response's content type, lower-cased. */
  type: string;
}

const native = Capacitor.isNativePlatform();
const TIMEOUT_MS = 20_000;

function header(headers: Record<string, string> | undefined, name: string): string {
  const key = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === name);
  return (key ? headers![key]! : '').toLowerCase();
}

export async function getJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<HttpResult<T | null>> {
  if (native) {
    const res = await CapacitorHttp.get({ url, headers, responseType: 'json', connectTimeout: TIMEOUT_MS, readTimeout: TIMEOUT_MS });
    const data = typeof res.data === 'string' ? (JSON.parse(res.data || 'null') as T) : (res.data as T);
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data, type: header(res.headers, 'content-type') };
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = res.ok ? ((await res.json()) as T) : null;
  return { ok: res.ok, status: res.status, data, type: (res.headers.get('content-type') ?? '').toLowerCase() };
}

export async function getBytes(url: string): Promise<HttpResult<Uint8Array>> {
  if (native) {
    const res = await CapacitorHttp.get({ url, responseType: 'arraybuffer', connectTimeout: TIMEOUT_MS, readTimeout: TIMEOUT_MS });
    const data = typeof res.data === 'string' ? base64ToBytes(res.data) : new Uint8Array(res.data as ArrayBuffer);
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data, type: header(res.headers, 'content-type') };
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
  return { ok: res.ok, status: res.status, data, type: (res.headers.get('content-type') ?? '').toLowerCase() };
}
