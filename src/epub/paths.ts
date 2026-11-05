// Paths inside an EPUB archive. Every path here is a zip path ("OEBPS/text/ch1.xhtml"):
// no leading slash, "/" separators, already percent-decoded.

/** The folder a zip path lives in, with a trailing slash ("" at the root). */
export function dirname(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(0, slash + 1) : '';
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** "chapter.xhtml" → ["chapter", "xhtml"]; "README" → ["README", ""]. */
export function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot + 1)] : [name, ''];
}

/** Splits "text/ch1.xhtml#note-3" into the path and the fragment ("" or "#note-3"). */
export function splitFragment(href: string): [string, string] {
  const hash = href.indexOf('#');
  return hash >= 0 ? [href.slice(0, hash), href.slice(hash)] : [href, ''];
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/** True for hrefs that leave the archive: http:, mailto:, data: and the like. */
export function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href.trim()) || href.trim().startsWith('//');
}

/**
 * Resolves an href written in a file under `baseDir` to a zip path, dropping
 * any fragment or query. "../images/a%20b.jpg" from "OEBPS/text/" → "OEBPS/images/a b.jpg".
 */
export function resolvePath(baseDir: string, href: string): string {
  const [withoutFragment] = splitFragment(href.trim());
  const clean = withoutFragment.split('?')[0] ?? '';
  if (!clean) return '';
  const stack = clean.startsWith('/') ? [] : baseDir.split('/').filter(Boolean);
  for (const part of clean.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') stack.pop();
    else stack.push(safeDecode(part));
  }
  return stack.join('/');
}

/** The href that reaches `toPath` from a file in `fromDir`, percent-encoded where needed. */
export function relativePath(fromDir: string, toPath: string): string {
  const from = fromDir.split('/').filter(Boolean);
  const to = toPath.split('/').filter(Boolean);
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  const parts = [...Array<string>(from.length - common).fill('..'), ...to.slice(common)];
  return parts.map((p) => (p === '..' ? p : encodeURIComponent(p).replace(/%2C/g, ','))).join('/');
}
