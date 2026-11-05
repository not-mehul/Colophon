// Binding: applies a Draft to an Edition and packs a new EPUB. The package
// document is edited through the DOM; content documents only have their
// links rewritten in place, so their formatting survives.

import { bytes, text, writeEpub, type Files } from './archive';
import { renames as renamesOf } from './draft';
import { imageMime } from './image-size';
import { isEpub3, writeA11y, writeMeta } from './metadata';
import { basename, dirname, isExternal, relativePath, resolvePath, splitExt, splitFragment } from './paths';
import { newNav, newNcx, retarget, writeNav, writeNcx } from './toc';
import type { Draft, Edition, TocEntry } from './types';
import { childrenNamed, firstNamed, NS, parseXml, serialize } from './xml';

export interface BindOptions {
  /** DEFLATE level for everything but the mimetype entry. */
  level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** Write both cover tags whatever the draft says (Settings). */
  dualCoverTags?: boolean;
  /** Leave out files the manifest does not list (Settings). */
  purgeOrphans?: boolean;
  now?: Date;
}

const TEXT_TYPES = /\.(x?html?|xml|ncx|opf|svg|css)$/i;
const CONTAINER_XML = (opfPath: string) => `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

const EXT_FOR: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  taken.add(id);
  return id;
}

function uniquePath(path: string, files: Files): string {
  if (!files.has(path)) return path;
  const [stem, ext] = splitExt(path);
  for (let i = 2; ; i++) {
    const next = `${stem}-${i}${ext ? `.${ext}` : ''}`;
    if (!files.has(next)) return next;
  }
}

/**
 * Rewrites href, src and xlink:href values in a file under `dir` that point at
 * a renamed file, keeping any fragment.
 */
export function rewriteLinks(source: string, dir: string, moved: Map<string, string>): string {
  if (!moved.size) return source;
  return source.replace(/(\s(?:href|src|xlink:href)\s*=\s*)(["'])([^"']*)\2/gi, (whole, lead: string, quote: string, href: string) => {
    if (!href || href.startsWith('#') || isExternal(href)) return whole;
    const target = moved.get(resolvePath(dir, href));
    if (!target) return whole;
    return `${lead}${quote}${relativePath(dir, target)}${splitFragment(href)[1]}${quote}`;
  });
}

export function bind(edition: Edition, draft: Draft, options: BindOptions = {}): Uint8Array {
  const files: Files = new Map(edition.files);
  const epub3 = isEpub3(edition.version);
  const now = options.now ?? new Date();

  // Files left out, and text fixes.
  for (const path of draft.removed) files.delete(path);
  if (options.purgeOrphans) for (const path of edition.orphans) files.delete(path);
  for (const [path, value] of Object.entries(draft.patched)) files.set(path, bytes(value));

  const doc = parseXml(edition.opfXml);
  const opfDir = edition.opfDir;
  const manifest = firstNamed(doc, 'manifest') ?? doc.documentElement.appendChild(doc.createElementNS(NS.opf, 'manifest'));
  const metadata = () => firstNamed(doc, 'metadata')!;
  const items = () => childrenNamed(manifest, 'item');
  const ids = new Set(items().map((el) => el.getAttribute('id') ?? ''));
  const itemById = (id: string) => items().find((el) => el.getAttribute('id') === id);
  const addItem = (id: string, path: string, mediaType: string, properties?: string) => {
    const el = doc.createElementNS(NS.opf, 'item');
    el.setAttribute('id', uniqueId(id, ids));
    el.setAttribute('href', relativePath(opfDir, path));
    el.setAttribute('media-type', mediaType);
    if (properties) el.setAttribute('properties', properties);
    manifest.appendChild(el);
    return el;
  };

  // 1. Imprint.
  writeMeta(doc, draft.meta, edition.meta, edition.version, now);

  // 2. Manifest items dropped because their files are missing.
  for (const id of draft.droppedItems) itemById(id)?.remove();

  // 3. Cover, and both cover tags.
  let coverEl: Element | undefined;
  if (draft.cover) {
    const mediaType = draft.cover.mediaType || imageMime(draft.cover.bytes);
    const ext = EXT_FOR[mediaType] ?? 'jpg';
    const original = edition.cover;
    let path: string;
    if (original) {
      const [stem, oldExt] = splitExt(original.path);
      path = EXT_FOR[original.mediaType] === ext || oldExt.toLowerCase() === ext ? original.path : `${stem}.${ext}`;
      if (path !== original.path) files.delete(original.path);
      coverEl = itemById(original.id);
    } else {
      path = uniquePath(`${opfDir}images/cover.${ext}`, files);
    }
    files.set(path, draft.cover.bytes);
    if (coverEl) {
      coverEl.setAttribute('href', relativePath(opfDir, path));
      coverEl.setAttribute('media-type', mediaType);
    } else {
      coverEl = addItem('cover-image', path, mediaType);
    }
  } else if (edition.cover) {
    coverEl = itemById(edition.cover.id);
  }
  if (coverEl) {
    const dual = !!(draft.cover || draft.dualCoverTags || options.dualCoverTags);
    const id = coverEl.getAttribute('id')!;
    if (epub3 && (dual || edition.cover?.epub3)) {
      const props = new Set((coverEl.getAttribute('properties') ?? '').split(/\s+/).filter(Boolean));
      props.add('cover-image');
      coverEl.setAttribute('properties', [...props].join(' '));
    }
    if (dual || edition.cover?.epub2 || !epub3) {
      childrenNamed(metadata(), 'meta')
        .filter((m) => m.getAttribute('name') === 'cover')
        .forEach((m) => m.remove());
      const meta = doc.createElementNS(NS.opf, 'meta');
      meta.setAttribute('name', 'cover');
      meta.setAttribute('content', id);
      metadata().appendChild(meta);
    }
  }

  // 4. Chapter files renamed, links to them rewritten, the spine reordered.
  const moved = renamesOf(draft);
  for (const [from, to] of moved) {
    const data = files.get(from);
    if (!data) continue;
    files.delete(from);
    files.set(to, data);
  }
  if (moved.size) {
    for (const [path, data] of files) {
      if (!TEXT_TYPES.test(path) || path === edition.opfPath) continue;
      const source = text(data);
      const next = rewriteLinks(source, dirname(path), moved);
      if (next !== source) files.set(path, bytes(next));
    }
  }
  for (const c of draft.chapters) {
    const to = moved.get(c.path);
    if (to) itemById(c.id)?.setAttribute('href', relativePath(opfDir, to));
  }
  const spine = firstNamed(doc, 'spine') ?? doc.documentElement.appendChild(doc.createElementNS(NS.opf, 'spine'));
  const refs = new Map(childrenNamed(spine, 'itemref').map((el) => [el.getAttribute('idref') ?? '', el]));
  childrenNamed(spine, 'itemref').forEach((el) => el.remove());
  const listed = new Set(items().map((el) => el.getAttribute('id')));
  for (const c of draft.chapters) {
    if (!listed.has(c.id)) continue;
    const el = refs.get(c.id) ?? doc.createElementNS(NS.opf, 'itemref');
    el.setAttribute('idref', c.id);
    spine.appendChild(el);
  }
  // Spine entries without a chapter (ones naming a missing item) are dropped.

  // 5. The table of contents, if it was edited.
  if (draft.toc) {
    const entries: TocEntry[] = retarget(draft.toc, moved);
    const title = draft.meta.title || 'Contents';
    let navPath = edition.navPath && files.has(moved.get(edition.navPath) ?? edition.navPath) ? (moved.get(edition.navPath) ?? edition.navPath) : '';
    let ncxPath = edition.ncxPath && files.has(edition.ncxPath) ? edition.ncxPath : '';
    if (navPath) {
      try {
        files.set(navPath, bytes(writeNav(text(files.get(navPath)), navPath, entries)));
      } catch {
        navPath = '';
      }
    }
    if (ncxPath) {
      try {
        files.set(ncxPath, bytes(writeNcx(text(files.get(ncxPath)), ncxPath, entries)));
      } catch {
        ncxPath = '';
      }
    }
    if (!navPath && epub3) {
      navPath = uniquePath(`${opfDir}nav.xhtml`, files);
      files.set(navPath, bytes(newNav(navPath, entries, title, draft.meta.language || 'en')));
      addItem('nav', navPath, 'application/xhtml+xml', 'nav');
    }
    if (!ncxPath && !edition.navPath) {
      ncxPath = uniquePath(`${opfDir}toc.ncx`, files);
      const uid = draft.meta.identifier || `urn:colophon:${basename(edition.fileName)}`;
      files.set(ncxPath, bytes(newNcx(ncxPath, entries, title, uid)));
      const el = addItem('ncx', ncxPath, 'application/x-dtbncx+xml');
      spine.setAttribute('toc', el.getAttribute('id')!);
    }
  }

  // 6. Accessibility metadata.
  if (draft.a11y) writeA11y(doc, draft.a11y, edition.version);

  // 7. The package document and a container that points at it.
  files.set(edition.opfPath, bytes(serialize(doc)));
  if (!edition.facts.containerValid) files.set('META-INF/container.xml', bytes(CONTAINER_XML(edition.opfPath)));

  return writeEpub(files, options.level ?? 6);
}
