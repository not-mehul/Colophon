// The catalogs: Google Books, Open Library, ISBNdb and a custom JSON endpoint.
// Each turns a query into CatalogRecords; failures resolve to an error, never throw.

import { getJson } from '../platform/http';
import { cleanIsbn, isIsbn } from './isbn';
import type { CatalogKeys, CatalogRecord, SourceId } from './types';

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const https = (url: string) => url.replace(/^http:\/\//i, 'https://');

/* eslint-disable @typescript-eslint/no-explicit-any -- catalog JSON is read field by field */

export function parseGoogle(data: any): CatalogRecord[] {
  if (!Array.isArray(data?.items)) return [];
  return data.items.map((item: any): CatalogRecord => {
    const info = item.volumeInfo ?? {};
    const ids: any[] = info.industryIdentifiers ?? [];
    const image = info.imageLinks ?? {};
    const cover = image.extraLarge || image.large || image.medium || image.thumbnail || image.smallThumbnail || '';
    return {
      source: 'google',
      title: [info.title, info.subtitle].filter(Boolean).join(': '),
      creator: (info.authors ?? []).join(', '),
      identifier: ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier ?? '',
      publisher: info.publisher ?? '',
      date: info.publishedDate ?? '',
      language: info.language ?? '',
      subjects: info.categories ?? [],
      description: stripHtml(info.description ?? ''),
      coverUrl: cover ? https(cover).replace('&edge=curl', '') : '',
    };
  });
}

export function parseOpenLibrary(data: any): CatalogRecord[] {
  if (!Array.isArray(data?.docs)) return [];
  return data.docs.map((doc: any): CatalogRecord => {
    const isbn: string[] = Array.isArray(doc.isbn) ? doc.isbn : [];
    const sentence = Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence;
    return {
      source: 'openlibrary',
      title: doc.title ?? '',
      creator: (doc.author_name ?? []).slice(0, 3).join(', '),
      identifier: isbn.find((i) => i.length === 13) ?? isbn[0] ?? '',
      publisher: (doc.publisher ?? [])[0] ?? '',
      date: doc.first_publish_year ? String(doc.first_publish_year) : '',
      language: (doc.language ?? [])[0] ?? '',
      subjects: (doc.subject ?? []).slice(0, 6),
      description: typeof sentence === 'string' ? sentence : '',
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    };
  });
}

export function parseIsbndb(data: any): CatalogRecord[] {
  const books: any[] = Array.isArray(data?.books) ? data.books : data?.book ? [data.book] : [];
  return books.map(
    (b): CatalogRecord => ({
      source: 'isbndb',
      title: b.title || b.title_long || '',
      creator: (b.authors ?? []).join(', '),
      identifier: b.isbn13 || b.isbn || '',
      publisher: b.publisher ?? '',
      date: b.date_published ?? '',
      language: b.language ?? '',
      subjects: b.subjects ?? [],
      description: stripHtml(b.synopsis ?? b.overview ?? ''),
      coverUrl: b.image ?? '',
    }),
  );
}

export function parseCustom(data: any): CatalogRecord[] {
  const items: any[] = Array.isArray(data) ? data : (data?.items ?? data?.results ?? []);
  return items.map(
    (it): CatalogRecord => ({
      source: 'custom',
      title: it.title ?? '',
      creator: Array.isArray(it.authors) ? it.authors.join(', ') : (it.creator ?? it.author ?? ''),
      identifier: it.isbn ?? it.identifier ?? '',
      publisher: it.publisher ?? '',
      date: it.date ?? it.publishedDate ?? '',
      language: it.language ?? '',
      subjects: Array.isArray(it.subjects) ? it.subjects : [],
      description: stripHtml(it.description ?? ''),
      coverUrl: it.coverUrl ?? it.image ?? '',
    }),
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function requestFor(source: SourceId, query: string, keys: CatalogKeys, max: number): { url: string; headers: Record<string, string> } | null {
  const q = encodeURIComponent(query);
  const isbn = isIsbn(query) ? cleanIsbn(query) : '';
  switch (source) {
    case 'google': {
      const key = keys.googleApiKey ? `&key=${encodeURIComponent(keys.googleApiKey)}` : '';
      return { url: `https://www.googleapis.com/books/v1/volumes?q=${isbn ? `isbn:${isbn}` : q}&maxResults=${max}${key}`, headers: {} };
    }
    case 'openlibrary':
      return { url: `https://openlibrary.org/search.json?${isbn ? `isbn=${isbn}` : `q=${q}`}&limit=${max}`, headers: {} };
    case 'isbndb':
      if (!keys.isbndbApiKey) return null;
      return {
        url: isbn ? `https://api2.isbndb.com/book/${isbn}` : `https://api2.isbndb.com/books/${q}?pageSize=${max}`,
        headers: { Authorization: keys.isbndbApiKey },
      };
    case 'custom': {
      if (!keys.customCatalogUrl) return null;
      const url = keys.customCatalogUrl.includes('{query}') ? keys.customCatalogUrl.replace(/\{query\}/g, q) : `${keys.customCatalogUrl}${keys.customCatalogUrl.includes('?') ? '&' : '?'}q=${q}`;
      const key = keys.customCatalogKey;
      return { url, headers: key ? { Authorization: key.startsWith('Bearer ') ? key : `Bearer ${key}` } : {} };
    }
  }
}

const PARSERS: Record<SourceId, (data: unknown) => CatalogRecord[]> = {
  google: parseGoogle,
  openlibrary: parseOpenLibrary,
  isbndb: parseIsbndb,
  custom: parseCustom,
};

export type SourceResult = { source: SourceId; records: CatalogRecord[]; error?: string };

export async function searchSource(source: SourceId, query: string, keys: CatalogKeys, max: number): Promise<SourceResult> {
  const request = requestFor(source, query, keys, max);
  if (!request) return { source, records: [] };
  try {
    const res = await getJson(request.url, request.headers);
    if (!res.ok) return { source, records: [], error: `HTTP ${res.status}` };
    return { source, records: PARSERS[source](res.data).slice(0, max) };
  } catch (err) {
    return { source, records: [], error: err instanceof Error ? err.message : String(err) };
  }
}
