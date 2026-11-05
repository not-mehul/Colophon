// File names: the bound EPUB's name from a template, and numbered chapter files.

import { splitExt } from './paths';
import type { ChapterDraft, Meta } from './types';

export const DEFAULT_TEMPLATE = '{Order} - {Author} - {Title} ({Year})';
export const DEFAULT_RENAME = 'chapter_{num}_{slug}.xhtml';

export const TEMPLATE_FIELDS = ['{Order}', '{Author}', '{Title}', '{Series}', '{SeriesIndex}', '{Year}', '{ISBN}', '{Lang}'] as const;

export const TEMPLATE_PRESETS = [
  { label: 'Order, author, title', template: '{Order} - {Author} - {Title}' },
  { label: 'Author, series, title', template: '{Author} - {Series} #{SeriesIndex} - {Title}' },
  { label: 'Title, author, year', template: '{Title} - {Author} ({Year})' },
] as const;

// eslint-disable-next-line no-control-regex
const UNSAFE = /[<>:"/\\|?*\u0000-\u001F]/g;

export function safeSegment(value: string): string {
  return String(value || '')
    .replace(UNSAFE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Applies a template like "{Author} - {Title} ({Year})", tidying the gaps empty fields leave. */
export function formatFileName(template: string, meta: Meta, order = '01'): string {
  const year = meta.date.match(/\d{4}/)?.[0] ?? '';
  const values: Record<string, string> = {
    order: safeSegment(order) || '01',
    author: safeSegment(meta.creator) || 'Unknown Author',
    title: safeSegment(meta.title) || 'Untitled',
    series: safeSegment(meta.series),
    seriesindex: safeSegment(meta.seriesIndex),
    year,
    isbn: safeSegment(meta.identifier),
    lang: safeSegment(meta.language) || 'en',
  };
  let out = template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key.toLowerCase()] ?? whole);
  out = safeSegment(
    out
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      .replace(/#\s*(?=-|$)/g, '')
      .replace(/\s+-\s+-\s+/g, ' - ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\-_]+|[\s\-_]+$/g, ''),
  );
  if (!out) out = 'edition';
  return out.toLowerCase().endsWith('.epub') ? out : `${out}.epub`;
}

export function slugify(value: string): string {
  return (
    String(value || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28)
      .replace(/-+$/, '') || 'section'
  );
}

/**
 * New file names for chapters in their current order: "{num}" is the
 * position, "{slug}" the heading and "{orig}" the old name. Names never clash.
 */
export function numberChapters(
  chapters: ChapterDraft[],
  titles: Map<string, string>,
  { pattern = DEFAULT_RENAME, start = 1, digits = 3 }: { pattern?: string; start?: number; digits?: number } = {},
): ChapterDraft[] {
  const used = new Set<string>();
  return chapters.map((c, i) => {
    const [stem, ext] = splitExt(c.path.slice(c.path.lastIndexOf('/') + 1));
    let name = safeSegment(
      (pattern.trim() || DEFAULT_RENAME)
        .replace(/\{num\}/gi, String(start + i).padStart(digits, '0'))
        .replace(/\{slug\}/gi, slugify(titles.get(c.id) ?? ''))
        .replace(/\{orig\}/gi, stem),
    );
    if (!/\.(xhtml|html|htm|xml)$/i.test(name)) name += `.${ext || 'xhtml'}`;
    if (used.has(name.toLowerCase())) name = name.replace(/(\.[^.]+)$/, `_${i + 1}$1`);
    used.add(name.toLowerCase());
    return { ...c, fileName: name };
  });
}

/** True when the chapter files in the main flow sort into reading order by name. */
export function namedInOrder(chapters: ChapterDraft[]): boolean {
  const names = chapters.filter((c) => c.linear).map((c) => c.fileName.toLowerCase());
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return names.every((n, i) => n === sorted[i]);
}
