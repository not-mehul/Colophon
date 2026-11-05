// The accessibility ledger: alternative text, the language of each content
// document, reading order, and EPUB Accessibility 1.1 discovery metadata.

import { text } from './archive';
import { effectiveToc, fileText, renames } from './draft';
import { basename, dirname, resolvePath, splitFragment } from './paths';
import type { A11yMeta, Draft, Edition, TocEntry } from './types';
import { allNamed, parseXml, serialize, wellFormedError } from './xml';

export interface MissingAlt {
  /** The content document. */
  doc: string;
  /** Position of the <img> among the document's images. */
  index: number;
  /** The image's zip path, for a thumbnail. */
  image: string;
}

export interface A11yReport {
  imageCount: number;
  missingAlt: MissingAlt[];
  /** Content documents with no lang or xml:lang on <html>. */
  missingLang: string[];
  /** True when the table of contents follows the spine. */
  readingOrder: boolean;
  /** Discovery properties present. */
  metadata: A11yMeta;
  /** Which required discovery properties are missing. */
  missingMetadata: string[];
}

const XHTML = new Set(['application/xhtml+xml', 'text/html']);

export const CONFORMS_TO = 'EPUB Accessibility 1.1 - WCAG 2.2 Level AA';

export const FEATURES = [
  { id: 'tableOfContents', label: 'Table of contents' },
  { id: 'structuralNavigation', label: 'Headings' },
  { id: 'readingOrder', label: 'Reading order' },
  { id: 'alternativeText', label: 'Alt text' },
  { id: 'displayTransformability', label: 'Reflowable' },
  { id: 'pageBreakMarkers', label: 'Page breaks' },
] as const;

function contentDocs(edition: Edition, draft: Draft) {
  const removed = new Set(draft.removed);
  return edition.manifest.filter((m) => m.exists && !removed.has(m.path) && XHTML.has(m.mediaType) && !m.properties.includes('nav'));
}

/** Whether the TOC's entries visit chapters in spine order. */
export function tocFollowsSpine(toc: TocEntry[], order: string[]): boolean {
  const position = new Map(order.map((p, i) => [p, i]));
  let last = -1;
  for (const entry of toc) {
    const at = position.get(splitFragment(entry.target)[0]);
    if (at === undefined) continue;
    if (at < last) return false;
    last = at;
  }
  return true;
}

/**
 * Reorders the TOC to follow the spine, moving each top-level entry with the
 * entries nested under it.
 */
export function sortTocBySpine(toc: TocEntry[], order: string[]): TocEntry[] {
  const position = new Map(order.map((p, i) => [p, i]));
  const blocks: TocEntry[][] = [];
  for (const entry of toc) {
    if (entry.depth === 0 || !blocks.length) blocks.push([entry]);
    else blocks[blocks.length - 1]!.push(entry);
  }
  const rank = (block: TocEntry[]) => position.get(splitFragment(block[0]!.target)[0]) ?? Number.MAX_SAFE_INTEGER;
  return blocks
    .map((block, i) => ({ block, i }))
    .sort((a, b) => rank(a.block) - rank(b.block) || a.i - b.i)
    .flatMap((b) => b.block);
}

export function inspectAccessibility(edition: Edition, draft: Draft): A11yReport {
  const read = (p: string) => fileText(edition, draft, p, text);
  let imageCount = 0;
  const missingAlt: MissingAlt[] = [];
  const missingLang: string[] = [];

  for (const item of contentDocs(edition, draft)) {
    const source = read(item.path);
    const htmlTag = source.match(/<html\b[^>]*>/i)?.[0] ?? '';
    if (!/\s(xml:)?lang\s*=\s*["'][^"']+["']/i.test(htmlTag)) missingLang.push(item.path);
    let index = 0;
    for (const img of source.matchAll(/<img\b[^>]*>/gi)) {
      imageCount++;
      if (!/\salt\s*=/i.test(img[0])) {
        const src = img[0].match(/\ssrc\s*=\s*(["'])([^"']*)\1/i)?.[2] ?? '';
        missingAlt.push({ doc: item.path, index, image: src ? resolvePath(dirname(item.path), src) : '' });
      }
      index++;
    }
  }

  // Spine order as it will be bound, after renames.
  const moved = renames(draft);
  const order = draft.chapters.map((c) => moved.get(c.path) ?? c.path);
  const toc = effectiveToc(edition, draft).map((e) => {
    const [path, fragment] = splitFragment(e.target);
    return { ...e, target: (moved.get(path) ?? path) + fragment };
  });

  const metadata = draft.a11y ?? edition.a11y;
  const missingMetadata = [
    !metadata.accessModes.length && 'access modes',
    !metadata.features.length && 'features',
    !metadata.hazards.length && 'hazards',
    !metadata.summary.trim() && 'a summary',
  ].filter((v): v is string => !!v);

  return { imageCount, missingAlt, missingLang, readingOrder: tocFollowsSpine(toc, order), metadata, missingMetadata };
}

/** Sets alt text on images by their position in a content document. */
export function writeAltText(source: string, alts: Map<number, string>): string | null {
  if (wellFormedError(source)) return null;
  const doc = parseXml(source);
  allNamed(doc, 'img').forEach((img, i) => {
    const alt = alts.get(i);
    if (alt !== undefined) img.setAttribute('alt', alt.trim());
  });
  return serialize(doc);
}

/** Adds lang and xml:lang to the <html> element. */
export function addLang(source: string, lang: string): string {
  return source.replace(/<html\b([^>]*)>/i, (whole, attrs: string) => {
    let next = attrs;
    if (!/\slang\s*=/i.test(next)) next += ` lang="${lang}"`;
    if (!/\sxml:lang\s*=/i.test(next)) next += ` xml:lang="${lang}"`;
    return next === attrs ? whole : `<html${next}>`;
  });
}

/** Discovery metadata that describes this edition honestly, for the reader to confirm. */
export function suggestA11y(edition: Edition, report: A11yReport, hasToc: boolean): A11yMeta {
  const hasImages = report.imageCount > 0 || edition.manifest.some((m) => m.mediaType.startsWith('image/') && m.id !== edition.cover?.id);
  const allAlt = report.missingAlt.length === 0;
  const features = [
    hasToc && 'tableOfContents',
    hasToc && 'structuralNavigation',
    report.readingOrder && 'readingOrder',
    hasImages && allAlt && 'alternativeText',
    'displayTransformability',
  ].filter((f): f is string => !!f);
  const sentences = [
    'This publication is reflowable text',
    hasToc ? 'with a navigable table of contents' : '',
    hasImages ? (allAlt ? 'and every image has a text alternative' : 'and some images lack a text alternative') : '',
  ].filter(Boolean);
  return {
    accessModes: hasImages ? ['textual', 'visual'] : ['textual'],
    accessModeSufficient: hasImages && !allAlt ? ['textual,visual'] : ['textual'],
    features,
    hazards: ['none'],
    summary: `${sentences.join(' ')}.`,
    conformsTo: report.missingAlt.length || report.missingLang.length || !hasToc ? '' : CONFORMS_TO,
  };
}

export const docName = basename;
