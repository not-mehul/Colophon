// Find and replace across the chapters, in the text the reader sees only:
// tags, attributes, comments and the insides of <script> and <style> are
// never touched, so a search for "class" or "span" can't break the markup.
// Entities are read as the characters they stand for ("&amp;" is "&"), and
// a replacement is escaped back, so "Fish & Chips" can be found and written.
// A match can't run across tags: "<em>very</em> good" holds "very" and
// " good", not "very good".

import type { Draft, Edition } from './types';
import { text } from './archive';

export interface FindOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
}

export interface ChapterMatches {
  /** Zip path of the content document. */
  path: string;
  title: string;
  count: number;
  /** A few matches in context, "…before [match] after…". */
  samples: { before: string; match: string; after: string }[];
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[name.toLowerCase()] ?? whole;
  });
}

export const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&#160;');

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function pattern(query: string, options: FindOptions = {}): RegExp | null {
  if (!query) return null;
  const body = escapeRegex(query);
  return new RegExp(options.wholeWord ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, `gu${options.matchCase ? '' : 'i'}`);
}

/**
 * The XHTML split into markup (kept as is) and text runs (searchable).
 * Only text inside <body> counts, and not inside <script>, <style> or comments.
 */
function segments(xhtml: string): { markup: boolean; value: string }[] {
  const out: { markup: boolean; value: string }[] = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(script|style)\b[\s\S]*?<\/\1\s*>|<[^>]*>/gi;
  const bodyStart = xhtml.search(/<body\b/i);
  let inBody = bodyStart < 0;
  let last = 0;
  for (let m = re.exec(xhtml); m; m = re.exec(xhtml)) {
    if (m.index > last) out.push({ markup: !inBody, value: xhtml.slice(last, m.index) });
    out.push({ markup: true, value: m[0] });
    if (/^<body\b/i.test(m[0])) inBody = true;
    else if (/^<\/body\b/i.test(m[0])) inBody = false;
    last = m.index + m[0].length;
  }
  if (last < xhtml.length) out.push({ markup: !inBody, value: xhtml.slice(last) });
  return out;
}

const SAMPLES = 3;
const CONTEXT = 30;

/** Every content document's matches, in reading order. */
export function findInChapters(edition: Edition, draft: Draft, query: string, options: FindOptions = {}): ChapterMatches[] {
  const re = pattern(query, options);
  if (!re) return [];
  const titles = new Map(edition.chapters.map((c) => [c.path, c.title]));
  const out: ChapterMatches[] = [];
  for (const chapter of draft.chapters) {
    const xhtml = draft.patched[chapter.path] ?? text(edition.files.get(chapter.path));
    const result: ChapterMatches = { path: chapter.path, title: titles.get(chapter.path) ?? chapter.fileName, count: 0, samples: [] };
    for (const seg of segments(xhtml)) {
      if (seg.markup) continue;
      const plain = decodeEntities(seg.value);
      for (const m of plain.matchAll(re)) {
        result.count++;
        if (result.samples.length < SAMPLES) {
          const start = m.index;
          const end = start + m[0].length;
          result.samples.push({
            before: (start > CONTEXT ? '…' : '') + plain.slice(Math.max(0, start - CONTEXT), start).replace(/\s+/g, ' '),
            match: m[0],
            after: plain.slice(end, end + CONTEXT).replace(/\s+/g, ' ') + (end + CONTEXT < plain.length ? '…' : ''),
          });
        }
      }
    }
    if (result.count) out.push(result);
  }
  return out;
}

/** The document with every match in its text replaced, and how many there were. */
export function replaceInXhtml(xhtml: string, query: string, replacement: string, options: FindOptions = {}): { xhtml: string; count: number } {
  const re = pattern(query, options);
  if (!re) return { xhtml, count: 0 };
  let count = 0;
  const next = segments(xhtml)
    .map((seg) => {
      if (seg.markup) return seg.value;
      const plain = decodeEntities(seg.value);
      let n = 0;
      const replaced = plain.replace(re, () => {
        n++;
        return replacement;
      });
      if (!n) return seg.value;
      count += n;
      return escapeText(replaced);
    })
    .join('');
  return { xhtml: count ? next : xhtml, count };
}

/** Replaces in every chapter (or only `paths`), writing into the draft's patched files. Returns the count. */
export function replaceInChapters(
  edition: Edition,
  draft: Draft,
  query: string,
  replacement: string,
  options: FindOptions = {},
  paths?: ReadonlySet<string>,
): number {
  let total = 0;
  for (const chapter of draft.chapters) {
    if (paths && !paths.has(chapter.path)) continue;
    const xhtml = draft.patched[chapter.path] ?? text(edition.files.get(chapter.path));
    const { xhtml: next, count } = replaceInXhtml(xhtml, query, replacement, options);
    if (count) {
      draft.patched[chapter.path] = next;
      total += count;
    }
  }
  return total;
}
