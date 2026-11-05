// How closely a catalog record matches the open edition, as a percentage.

import type { Meta } from '../epub/types';
import { cleanIsbn } from './isbn';
import type { CatalogRecord } from './types';

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function confidence(record: CatalogRecord, meta: Meta): number {
  let score = 40;
  const isbn = cleanIsbn(meta.identifier);
  const candidate = cleanIsbn(record.identifier);
  if (isbn.length >= 10 && candidate && (candidate.includes(isbn) || isbn.includes(candidate))) score += 45;

  const title = norm(meta.title);
  const theirs = norm(record.title);
  if (title && theirs) {
    if (theirs === title) score += 28;
    else if (theirs.startsWith(title) || title.startsWith(theirs)) score += 20;
    else if (theirs.includes(title) || title.includes(theirs)) score += 12;
  }

  const author = norm(meta.creator.split(',')[0] ?? '');
  const theirAuthor = norm(record.creator);
  if (author && theirAuthor) {
    const surname = author.split(' ').pop() ?? author;
    if (theirAuthor.includes(author) || author.includes(theirAuthor)) score += 18;
    else if (surname.length > 2 && theirAuthor.includes(surname)) score += 10;
  }
  if (record.coverUrl) score += 3;
  return Math.min(99, score);
}

/** Drops records that repeat one already listed (same ISBN, or same title and author). */
export function dedupe(records: CatalogRecord[]): CatalogRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    const key = cleanIsbn(r.identifier) || `${norm(r.title)}|${norm(r.creator)}`;
    if (seen.has(`${r.source}:${key}`)) return false;
    seen.add(`${r.source}:${key}`);
    return true;
  });
}

/** Google Books thumbnails come at zoom=1; zoom=2 or more is the larger scan. */
export function largerCover(url: string): string {
  let clean = url.trim().replace(/^http:\/\//i, 'https://');
  if (clean.includes('books.google.com/books/content') || clean.includes('books.googleusercontent.com')) {
    clean = clean.replace(/&edge=curl/gi, '').replace(/zoom=\d/, 'zoom=2');
  }
  return clean;
}
