// A catalog search across the chosen sources, with the offline cache behind it.

import type { Meta } from '../epub/types';
import { cached, FRESH_MS, remember } from './cache';
import { confidence, dedupe } from './match';
import { searchSource } from './sources';
import type { CatalogKeys, CatalogRecord, SourceId } from './types';

export type SearchScope = 'all' | 'google' | 'openlibrary' | 'isbndb';

export interface ScoredRecord extends CatalogRecord {
  confidence: number;
}

export interface SearchOutcome {
  results: ScoredRecord[];
  /** Set when some or all results came from the cache: the oldest fetch time used. */
  cachedAt: number | null;
  /** Sources that failed and had nothing cached. */
  failed: SourceId[];
}

export function sourcesFor(scope: SearchScope, keys: CatalogKeys): SourceId[] {
  const list: SourceId[] = scope === 'all' ? ['google', 'openlibrary'] : [scope];
  if (scope === 'all' && keys.isbndbApiKey) list.push('isbndb');
  if (keys.customCatalogUrl) list.push('custom');
  return list;
}

export async function searchCatalogs(
  query: string,
  scope: SearchScope,
  keys: CatalogKeys,
  max: number,
  meta: Meta,
  { online = globalThis.navigator?.onLine !== false, now = Date.now() } = {},
): Promise<SearchOutcome> {
  let cachedAt: number | null = null;
  const failed: SourceId[] = [];
  const batches = await Promise.all(
    sourcesFor(scope, keys).map(async (source) => {
      const saved = await cached(source, query).catch(() => null);
      if (saved && (!online || now - saved.fetchedAt < FRESH_MS / 7)) {
        cachedAt = Math.min(cachedAt ?? saved.fetchedAt, saved.fetchedAt);
        return saved.records;
      }
      const result = online ? await searchSource(source, query, keys, max) : { source, records: [], error: 'offline' };
      if (!result.error) {
        await remember(source, query, result.records, now).catch(() => undefined);
        return result.records;
      }
      if (saved) {
        cachedAt = Math.min(cachedAt ?? saved.fetchedAt, saved.fetchedAt);
        return saved.records;
      }
      failed.push(source);
      return [];
    }),
  );
  const results = dedupe(batches.flat())
    .map((r) => ({ ...r, confidence: confidence(r, meta) }))
    .sort((a, b) => b.confidence - a.confidence);
  return { results, cachedAt, failed };
}
