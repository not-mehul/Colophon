// Colophon's IndexedDB (Dexie): the library bench, settings and the catalog cache.
// An edition's bytes live in their own table, so listing the bench stays light.

import Dexie, { type EntityTable } from 'dexie';
import type { CatalogRecord, SourceId } from '../catalog/types';
import type { Draft } from '../epub/types';
import type { Settings } from './settings';

export interface StoredEdition {
  id: string;
  fileName: string;
  title: string;
  creator: string;
  /** The inspection score when last seen. */
  score: number;
  /** A small JPEG of the cover, for the bench. */
  thumb: Uint8Array | null;
  size: number;
  openedAt: number;
  boundAt: number | null;
  /** Where the app last saved it (Documents/Colophon/…), so a bind saves over it. */
  savedPath: string | null;
  /** Unsaved edits. */
  draft: Draft | null;
}

export interface StoredBytes {
  id: string;
  bytes: Uint8Array;
}

export interface StoredSettings {
  id: 'settings';
  value: Partial<Settings>;
}

export interface CachedSearch {
  /** `${source}|${query}` in lower case. */
  key: string;
  source: SourceId;
  query: string;
  records: CatalogRecord[];
  fetchedAt: number;
}

export const db = new Dexie('colophon') as Dexie & {
  editions: EntityTable<StoredEdition, 'id'>;
  bytes: EntityTable<StoredBytes, 'id'>;
  settings: EntityTable<StoredSettings, 'id'>;
  catalog: EntityTable<CachedSearch, 'key'>;
};

db.version(1).stores({
  editions: 'id, openedAt',
  bytes: 'id',
  settings: 'id',
  catalog: 'key, fetchedAt',
});
