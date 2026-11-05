// Opening an EPUB: the container, the package document, the manifest and
// spine, the cover and the table of contents, read into an Edition.

import { EPUB_MIME, readZip, text } from './archive';
import { imageSize } from './image-size';
import { readA11y, readMeta } from './metadata';
import { basename, dirname, resolvePath } from './paths';
import { readNav, readNcx } from './toc';
import type { Chapter, Cover, Edition, ManifestItem } from './types';
import { allNamed, childrenNamed, firstNamed, parseHtml, parseXml, textOf } from './xml';

export class EpubError extends Error {}

/** Words in a content document, and its first heading (or its <title>). */
export function readChapter(source: string): { title: string; words: number } {
  const doc = parseHtml(source);
  const heading = doc.querySelector('h1, h2, h3') ?? doc.querySelector('title');
  const body = doc.body?.textContent ?? source.replace(/<[^>]+>/g, ' ');
  return { title: textOf(heading ?? undefined), words: body.trim().match(/\S+/g)?.length ?? 0 };
}

export function openEpub(data: Uint8Array, fileName = 'edition.epub'): Edition {
  const { files, facts } = readZip(data);

  const mimetype = files.get('mimetype');
  const mimetypeExists = !!mimetype;
  const mimetypeValid = text(mimetype).trim() === EPUB_MIME;
  const mimetypeFirst = facts.firstEntry === 'mimetype' && facts.firstStored;

  // The container names the package document; fall back to any .opf.
  let opfPath = '';
  let containerValid = false;
  const container = files.get('META-INF/container.xml');
  if (container) {
    try {
      const rootfile = firstNamed(parseXml(text(container)), 'rootfile');
      opfPath = rootfile?.getAttribute('full-path')?.trim() ?? '';
      containerValid = !!opfPath && files.has(opfPath);
    } catch {
      // Malformed container: look for the package below.
    }
  }
  if (!files.has(opfPath)) {
    opfPath = [...files.keys()].find((p) => p.toLowerCase().endsWith('.opf')) ?? '';
  }
  if (!opfPath) throw new EpubError('there is no package document (.opf) in the archive');

  const opfXml = text(files.get(opfPath));
  let doc: Document;
  try {
    doc = parseXml(opfXml);
  } catch (err) {
    throw new EpubError(`the package document is not well-formed XML (${err instanceof Error ? err.message : String(err)})`);
  }
  const opfDir = dirname(opfPath);
  const pkg = doc.documentElement;
  const version = pkg.getAttribute('version') || '2.0';
  const meta = readMeta(doc);

  // Manifest.
  let epub2CoverId = '';
  for (const m of allNamed(doc, 'meta')) {
    if ((m.getAttribute('name') ?? '').toLowerCase() === 'cover') epub2CoverId = m.getAttribute('content') ?? '';
  }
  const manifestEl = firstNamed(doc, 'manifest');
  const manifest: ManifestItem[] = (manifestEl ? childrenNamed(manifestEl, 'item') : []).map((el) => {
    const href = el.getAttribute('href') ?? '';
    const path = resolvePath(opfDir, href);
    return {
      id: el.getAttribute('id') ?? '',
      href,
      path,
      mediaType: el.getAttribute('media-type') ?? '',
      properties: (el.getAttribute('properties') ?? '').split(/\s+/).filter(Boolean),
      exists: files.has(path),
    };
  });
  const byId = new Map(manifest.map((m) => [m.id, m]));
  const listed = new Set(manifest.map((m) => m.path));
  const orphans = [...files.keys()].filter(
    (p) => p !== 'mimetype' && !p.startsWith('META-INF/') && p !== opfPath && !listed.has(p),
  );

  const navItem = manifest.find((m) => m.properties.includes('nav'));
  const spineEl = firstNamed(doc, 'spine');
  const ncxItem = byId.get(spineEl?.getAttribute('toc') ?? '') ?? manifest.find((m) => m.mediaType === 'application/x-dtbncx+xml');

  // Spine and chapters.
  const spine = (spineEl ? childrenNamed(spineEl, 'itemref') : []).map((el) => ({
    idref: el.getAttribute('idref') ?? '',
    linear: el.getAttribute('linear') !== 'no',
  }));
  let totalWords = 0;
  const chapters: Chapter[] = [];
  spine.forEach((ref, i) => {
    const item = byId.get(ref.idref);
    if (!item?.exists) return;
    const { title, words } = readChapter(text(files.get(item.path)));
    totalWords += words;
    chapters.push({ id: item.id, path: item.path, title: title || `Chapter ${i + 1}`, words, linear: ref.linear });
  });

  // Cover: EPUB 3's property, EPUB 2's meta, or an image that calls itself one.
  const coverItem =
    manifest.find((m) => m.properties.includes('cover-image')) ??
    (epub2CoverId ? byId.get(epub2CoverId) : undefined) ??
    manifest.find((m) => m.mediaType.startsWith('image/') && /cover/i.test(`${m.id} ${m.href}`));
  let cover: Cover | null = null;
  if (coverItem?.exists && coverItem.mediaType.startsWith('image/')) {
    const bytes = files.get(coverItem.path)!;
    cover = {
      id: coverItem.id,
      href: coverItem.href,
      path: coverItem.path,
      mediaType: coverItem.mediaType,
      bytes,
      ...imageSize(bytes),
      epub2: !!epub2CoverId && epub2CoverId === coverItem.id,
      epub3: coverItem.properties.includes('cover-image'),
    };
  }

  // Table of contents: the nav document if it reads, else the NCX.
  const navPath = navItem?.exists ? navItem.path : '';
  const ncxPath = ncxItem?.exists ? ncxItem.path : '';
  let toc = [] as Edition['toc'];
  try {
    if (navPath) toc = readNav(text(files.get(navPath)), navPath);
  } catch {
    toc = [];
  }
  if (!toc.length && ncxPath) {
    try {
      toc = readNcx(text(files.get(ncxPath)), ncxPath);
    } catch {
      toc = [];
    }
  }

  return {
    fileName: fileName || basename(opfPath),
    fileSize: data.byteLength,
    files,
    facts: { mimetypeExists, mimetypeValid, mimetypeFirst, containerValid },
    opfPath,
    opfDir,
    opfXml,
    version,
    uniqueIdentifierId: pkg.getAttribute('unique-identifier') ?? '',
    meta,
    manifest,
    spine,
    chapters,
    cover,
    orphans,
    navPath,
    ncxPath,
    toc,
    a11y: readA11y(doc),
    totalWords,
  };
}
