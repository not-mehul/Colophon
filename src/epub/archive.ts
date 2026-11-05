// Reading and writing the zip container (OCF). fflate does the inflating; the
// first local file header is read by hand, because the spec cares about the
// order and compression of the mimetype entry and unzip hides both.

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

/** The archive's files by zip path. Folders are not kept. */
export type Files = Map<string, Uint8Array>;

export interface ZipFacts {
  /** Name of the first entry in the zip, or null for an empty archive. */
  firstEntry: string | null;
  /** True when the first entry is stored, not deflated. */
  firstStored: boolean;
}

export const EPUB_MIME = 'application/epub+zip';

export class ArchiveError extends Error {}

function readFirstHeader(bytes: Uint8Array): ZipFacts {
  // Local file header: signature PK\3\4, method at 8, name length at 26, name at 30.
  if (bytes.length < 30 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) {
    return { firstEntry: null, firstStored: false };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const method = view.getUint16(8, true);
  const nameLength = view.getUint16(26, true);
  const name = strFromU8(bytes.subarray(30, 30 + nameLength));
  return { firstEntry: name, firstStored: method === 0 };
}

export function readZip(bytes: Uint8Array): { files: Files; facts: ZipFacts } {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (err) {
    throw new ArchiveError(`not a zip archive (${err instanceof Error ? err.message : String(err)})`);
  }
  const files: Files = new Map();
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith('/')) continue;
    files.set(path.replace(/^\/+/, ''), data);
  }
  return { files, facts: readFirstHeader(bytes) };
}

/**
 * Packs files as an EPUB: the mimetype entry first and stored (OCF §4.3),
 * everything else deflated at `level`.
 */
export function writeEpub(files: Files, level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 6): Uint8Array {
  const zippable: Zippable = { mimetype: [strToU8(EPUB_MIME), { level: 0 }] };
  for (const [path, data] of files) {
    if (path === 'mimetype') continue;
    zippable[path] = [data, { level }];
  }
  return zipSync(zippable);
}

/** UTF-8 text, without a byte-order mark (DOMParser rejects one before <?xml). */
export const text = (bytes: Uint8Array | undefined): string => (bytes ? strFromU8(bytes).replace(/^\uFEFF/, '') : '');
export const bytes = (value: string): Uint8Array => strToU8(value);
