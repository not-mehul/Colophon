import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanIsbn, isbnFromBarcode, isIsbn, isbn10to13 } from '../../src/catalog/isbn';
import { confidence, largerCover } from '../../src/catalog/match';
import { searchCatalogs, sourcesFor } from '../../src/catalog/search';
import { parseGoogle, parseOpenLibrary, requestFor } from '../../src/catalog/sources';
import { EMPTY_META } from '../../src/epub/types';
import { db } from '../../src/state/db';

const keys = { googleApiKey: '', isbndbApiKey: '', customCatalogUrl: '', customCatalogKey: '' };
const meta = { ...EMPTY_META, title: 'Great Expectations', creator: 'Charles Dickens', identifier: '978-0-14-143956-3' };

const google = {
  items: [
    {
      volumeInfo: {
        title: 'Great Expectations',
        authors: ['Charles Dickens'],
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141439563' }],
        publisher: 'Penguin',
        publishedDate: '2002-12-31',
        description: '<p>Pip, an orphan…</p>',
        imageLinks: { thumbnail: 'http://books.google.com/books/content?id=x&zoom=1&edge=curl' },
      },
    },
  ],
};
const openLibrary = { docs: [{ title: 'Great expectations', author_name: ['Charles Dickens'], isbn: ['0141439564', '9780141439563'], cover_i: 42, first_publish_year: 1861 }] };

describe('ISBNs', () => {
  it('checks and converts', () => {
    expect(cleanIsbn('urn:isbn:978-0-14-143956-3')).toBe('9780141439563');
    expect(isIsbn('978-0-14-143956-3')).toBe(true);
    expect(isIsbn('9780141439564')).toBe(false);
    expect(isIsbn('0-14-143956-4')).toBe(true);
    expect(isbn10to13('0141439564')).toBe('9780141439563');
    expect(isbnFromBarcode('9780141439563')).toBe('9780141439563');
    expect(isbnFromBarcode('0012345678905')).toBeNull();
  });
});

describe('catalog records', () => {
  it('reads Google Books and Open Library', () => {
    const [g] = parseGoogle(google);
    expect(g).toMatchObject({ source: 'google', identifier: '9780141439563', description: 'Pip, an orphan…' });
    expect(g!.coverUrl).toBe('https://books.google.com/books/content?id=x&zoom=1');
    expect(largerCover(g!.coverUrl)).toContain('zoom=2');
    const [o] = parseOpenLibrary(openLibrary);
    expect(o).toMatchObject({ identifier: '9780141439563', date: '1861', coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' });
  });

  it('searches by ISBN when the query is one', () => {
    expect(requestFor('google', '9780141439563', keys, 8)?.url).toContain('q=isbn:9780141439563');
    expect(requestFor('openlibrary', '9780141439563', keys, 8)?.url).toContain('isbn=9780141439563');
    expect(requestFor('isbndb', 'x', keys, 8)).toBeNull();
    expect(requestFor('custom', 'a b', { ...keys, customCatalogUrl: 'https://c.example/s?term={query}', customCatalogKey: 'k' }, 8)).toEqual({
      url: 'https://c.example/s?term=a%20b',
      headers: { Authorization: 'Bearer k' },
    });
    expect(sourcesFor('all', { ...keys, isbndbApiKey: 'x' })).toEqual(['google', 'openlibrary', 'isbndb']);
  });

  it('scores a matching ISBN, title and author highly', () => {
    const [g] = parseGoogle(google);
    expect(confidence(g!, meta)).toBe(99);
    expect(confidence({ ...g!, identifier: '', title: 'Bleak House' }, meta)).toBeLessThan(70);
  });
});

describe('the offline catalog cache', () => {
  beforeEach(async () => {
    await db.catalog.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('serves the last results when the network is gone', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('googleapis') ? google : openLibrary), { status: 200 })));
    const first = await searchCatalogs('Great Expectations', 'all', keys, 8, meta, { now: 1000 });
    expect(first.cachedAt).toBeNull();
    expect(first.results).toHaveLength(2);

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const later = 1000 + 3 * 24 * 60 * 60 * 1000;
    const offline = await searchCatalogs('great expectations ', 'all', keys, 8, meta, { now: later });
    expect(offline.results).toHaveLength(2);
    expect(offline.cachedAt).toBe(1000);
    expect(offline.failed).toEqual([]);

    const nothing = await searchCatalogs('Bleak House', 'all', keys, 8, meta, { online: false });
    expect(nothing.results).toEqual([]);
    expect(nothing.failed).toEqual(['google', 'openlibrary']);
  });
});
