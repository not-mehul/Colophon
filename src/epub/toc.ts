// The table of contents: EPUB 3's navigation document and EPUB 2's NCX.
// Both are read into one flat list of entries with a depth, edited as that
// list, and written back into whichever of the two files the edition has.

import { dirname, relativePath, resolvePath, splitFragment } from './paths';
import type { Chapter, TocEntry } from './types';
import { allNamed, childrenNamed, escapeXml, NS, parseHtml, parseXml, serialize, textOf, wellFormedError } from './xml';

function epubType(el: Element): string {
  return el.getAttribute('epub:type') ?? el.getAttributeNS(NS.epub, 'type') ?? '';
}

/** The <nav epub:type="toc"> element, or the first <nav>. */
export function tocNav(doc: Document): Element | undefined {
  const navs = allNamed(doc, 'nav');
  return navs.find((n) => epubType(n).split(/\s+/).includes('toc')) ?? navs[0];
}

function target(baseDir: string, href: string): string {
  const [, fragment] = splitFragment(href);
  return resolvePath(baseDir, href) + fragment;
}

export function readNav(source: string, navPath: string): TocEntry[] {
  const doc = wellFormedError(source) ? parseHtml(source) : parseXml(source);
  const nav = tocNav(doc);
  const list = nav && childrenNamed(nav, 'ol')[0];
  if (!list) return [];
  const baseDir = dirname(navPath);
  const out: TocEntry[] = [];
  const walk = (ol: Element, depth: number) => {
    for (const li of childrenNamed(ol, 'li')) {
      const link = childrenNamed(li, 'a')[0] ?? childrenNamed(li, 'span')[0];
      const href = link?.getAttribute('href') ?? '';
      out.push({ label: textOf(link) || 'Untitled', target: href ? target(baseDir, href) : '', depth });
      const nested = childrenNamed(li, 'ol')[0];
      if (nested) walk(nested, depth + 1);
    }
  };
  walk(list, 0);
  return out;
}

export function readNcx(source: string, ncxPath: string): TocEntry[] {
  const doc = parseXml(source);
  const navMap = allNamed(doc, 'navMap')[0];
  if (!navMap) return [];
  const baseDir = dirname(ncxPath);
  const out: TocEntry[] = [];
  const walk = (parent: Element, depth: number) => {
    for (const point of childrenNamed(parent, 'navPoint')) {
      const label = textOf(allNamed(childrenNamed(point, 'navLabel')[0] ?? point, 'text')[0]);
      const src = childrenNamed(point, 'content')[0]?.getAttribute('src') ?? '';
      out.push({ label: label || 'Untitled', target: src ? target(baseDir, src) : '', depth });
      walk(point, depth + 1);
    }
  };
  walk(navMap, 0);
  return out;
}

/** One entry per chapter, in reading order: the TOC a book without one should have. */
export function tocFromChapters(chapters: Pick<Chapter, 'path' | 'title'>[]): TocEntry[] {
  return chapters.map((c) => ({ label: c.title, target: c.path, depth: 0 }));
}

/** Depths that never jump more than one level deeper than the entry before. */
export function normaliseDepths(entries: TocEntry[]): TocEntry[] {
  let previous = -1;
  return entries.map((e) => {
    const depth = Math.max(0, Math.min(e.depth, previous + 1));
    previous = depth;
    return { ...e, depth };
  });
}

/** Rewrites a TOC target after chapter files were renamed. */
export function retarget(entries: TocEntry[], renames: Map<string, string>): TocEntry[] {
  return entries.map((e) => {
    const [path, fragment] = splitFragment(e.target);
    const renamed = renames.get(path);
    return renamed ? { ...e, target: renamed + fragment } : e;
  });
}

function hrefFrom(baseDir: string, entry: TocEntry): string {
  const [path, fragment] = splitFragment(entry.target);
  return path ? relativePath(baseDir, path) + fragment : fragment;
}

/** Writes entries into the navigation document's toc <nav>, keeping the rest of the file. */
export function writeNav(source: string, navPath: string, entries: TocEntry[]): string {
  const doc = parseXml(source);
  const nav = tocNav(doc);
  if (!nav) throw new Error('The navigation document has no <nav>.');
  childrenNamed(nav, 'ol').forEach((ol) => ol.remove());
  const baseDir = dirname(navPath);
  const make = (name: string) => doc.createElementNS(NS.xhtml, name);
  const root = make('ol');
  const stack: Element[] = [root];
  let lastLi: Element | null = null;
  for (const entry of normaliseDepths(entries)) {
    while (stack.length - 1 > entry.depth) stack.pop();
    if (stack.length - 1 < entry.depth && lastLi) {
      const nested = make('ol');
      lastLi.appendChild(nested);
      stack.push(nested);
    }
    const li = make('li');
    const a = make('a');
    a.setAttribute('href', hrefFrom(baseDir, entry));
    a.textContent = entry.label;
    li.appendChild(a);
    stack[stack.length - 1]!.appendChild(li);
    lastLi = li;
  }
  nav.appendChild(root);
  return serialize(doc);
}

/** Rebuilds the NCX navMap, numbering playOrder in reading order. */
export function writeNcx(source: string, ncxPath: string, entries: TocEntry[]): string {
  const doc = parseXml(source);
  const navMap = allNamed(doc, 'navMap')[0];
  if (!navMap) throw new Error('The NCX has no navMap.');
  childrenNamed(navMap, 'navPoint').forEach((p) => p.remove());
  const baseDir = dirname(ncxPath);
  const make = (name: string) => doc.createElementNS(NS.ncx, name);
  const stack: Element[] = [navMap];
  let last: Element | null = null;
  normaliseDepths(entries).forEach((entry, i) => {
    while (stack.length - 1 > entry.depth) stack.pop();
    if (stack.length - 1 < entry.depth && last) stack.push(last);
    const point = make('navPoint');
    point.setAttribute('id', `navPoint-${i + 1}`);
    point.setAttribute('playOrder', String(i + 1));
    const label = make('navLabel');
    const textEl = make('text');
    textEl.textContent = entry.label;
    label.appendChild(textEl);
    const content = make('content');
    content.setAttribute('src', hrefFrom(baseDir, entry));
    point.append(label, content);
    stack[stack.length - 1]!.appendChild(point);
    last = point;
  });
  return serialize(doc);
}

/** A new EPUB 3 navigation document. */
export function newNav(navPath: string, entries: TocEntry[], title: string, lang: string): string {
  const shell = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(lang)}" xml:lang="${escapeXml(lang)}">
<head><meta charset="UTF-8"/><title>${escapeXml(title)}</title></head>
<body><nav epub:type="toc" id="toc"><h1>Contents</h1></nav></body>
</html>`;
  return writeNav(shell, navPath, entries);
}

/** A new NCX, for EPUB 2 readers. */
export function newNcx(ncxPath: string, entries: TocEntry[], title: string, uid: string): string {
  const shell = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${escapeXml(uid)}"/><meta name="dtb:depth" content="1"/></head>
<docTitle><text>${escapeXml(title)}</text></docTitle>
<navMap/>
</ncx>`;
  return writeNcx(shell, ncxPath, entries);
}
