// Catalog searches are kept for offline use: a search that can't reach the
// network shows the last results for the same query, and says when they're from.

import { db } from '../state/db';
import type { CatalogRecord, SourceId } from './types';

/** Older results are refetched when online; offline, any age will do. */
export const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP = 200;

const keyOf = (source: SourceId, query: string) => `${source}|${query.trim().toLowerCase()}`;

export async function cached(source: SourceId, query: string): Promise<{ records: CatalogRecord[]; fetchedAt: number } | null> {
  const hit = await db.catalog.get(keyOf(source, query));
  return hit ? { records: hit.records, fetchedAt: hit.fetchedAt } : null;
}

export async function remember(source: SourceId, query: string, records: CatalogRecord[], now = Date.now()): Promise<void> {
  await db.catalog.put({ key: keyOf(source, query), source, query: query.trim(), records, fetchedAt: now });
  const count = await db.catalog.count();
  if (count > KEEP) {
    const old = await db.catalog.orderBy('fetchedAt').limit(count - KEEP).primaryKeys();
    await db.catalog.bulkDelete(old);
  }
}

/** Recent queries, newest first, for suggestions while offline. */
export async function recentQueries(limit = 8): Promise<string[]> {
  const rows = await db.catalog.orderBy('fetchedAt').reverse().limit(limit * 4).toArray();
  return [...new Set(rows.map((r) => r.query))].slice(0, limit);
}
