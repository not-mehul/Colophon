// Downloading a catalog cover. In the apps, native HTTP has no CORS; in a
// browser, a cover host that sends no CORS headers needs the proxy from Settings.

import { imageMime } from '../epub/image-size';
import { getBytes } from '../platform/http';
import { isNative } from '../platform/native';
import { largerCover } from './match';

export async function fetchCover(url: string, corsProxy = ''): Promise<{ bytes: Uint8Array; mediaType: string }> {
  const target = largerCover(url);
  const attempts = [target];
  if (!isNative && corsProxy.trim()) attempts.push(corsProxy.includes('{url}') ? corsProxy.replace('{url}', encodeURIComponent(target)) : `${corsProxy.trim()}${encodeURIComponent(target)}`);
  let last: unknown = null;
  for (const at of attempts) {
    try {
      const res = await getBytes(at);
      if (res.ok && res.data.byteLength > 1000) {
        const mediaType = imageMime(res.data, '');
        if (mediaType) return { bytes: res.data, mediaType };
      }
      last = new Error(`the server answered ${res.status}`);
    } catch (err) {
      last = err;
    }
  }
  throw new Error(!isNative && !corsProxy ? 'the cover host blocks browsers; add a CORS proxy in Settings' : last instanceof Error ? last.message : 'download failed');
}
