// The library bench: the editions opened recently, newest first, each with
// its bytes, its last score and any unsaved edits.

import type { Draft } from '../epub/types';
import { db, type StoredEdition } from './db';

export const MAX_EDITIONS = 40;

class LibraryState {
  items = $state.raw<StoredEdition[]>([]);
  /** Ids picked in selection mode (long press). */
  selected = $state<string[]>([]);
  loaded = $state(false);

  async load(): Promise<void> {
    this.items = await db.editions.orderBy('openedAt').reverse().toArray();
    this.loaded = true;
  }

  get(id: string): StoredEdition | undefined {
    return this.items.find((e) => e.id === id);
  }

  async bytes(id: string): Promise<Uint8Array | undefined> {
    return (await db.bytes.get(id))?.bytes;
  }

  async add(entry: Omit<StoredEdition, 'id'>, bytes: Uint8Array): Promise<string> {
    const id = crypto.randomUUID();
    await db.transaction('rw', db.editions, db.bytes, async () => {
      await db.editions.put({ ...entry, id });
      await db.bytes.put({ id, bytes });
    });
    // Keep the bench to a sensible size: the oldest drop off.
    const extra = (await db.editions.orderBy('openedAt').reverse().offset(MAX_EDITIONS).primaryKeys()) as string[];
    if (extra.length) await this.deleteRows(extra);
    await this.load();
    return id;
  }

  async update(id: string, patch: Partial<Omit<StoredEdition, 'id'>>, bytes?: Uint8Array): Promise<void> {
    await db.transaction('rw', db.editions, db.bytes, async () => {
      await db.editions.update(id, patch);
      if (bytes) await db.bytes.put({ id, bytes });
    });
    this.items = this.items.map((e) => (e.id === id ? { ...e, ...patch } : e));
  }

  async saveDraft(id: string, draft: Draft | null, score: number): Promise<void> {
    await db.editions.update(id, { draft, score });
    this.items = this.items.map((e) => (e.id === id ? { ...e, draft, score } : e));
  }

  /** Removes editions, returning what's needed to put them back. */
  async remove(ids: string[]): Promise<() => Promise<void>> {
    const rows = await db.editions.bulkGet(ids);
    const blobs = await db.bytes.bulkGet(ids);
    await this.deleteRows(ids);
    this.selected = this.selected.filter((s) => !ids.includes(s));
    await this.load();
    return async () => {
      await db.transaction('rw', db.editions, db.bytes, async () => {
        await db.editions.bulkPut(rows.filter((r): r is StoredEdition => !!r));
        await db.bytes.bulkPut(blobs.filter((b): b is NonNullable<typeof b> => !!b));
      });
      await this.load();
    };
  }

  private async deleteRows(ids: string[]): Promise<void> {
    await db.transaction('rw', db.editions, db.bytes, async () => {
      await db.editions.bulkDelete(ids);
      await db.bytes.bulkDelete(ids);
    });
  }

  toggle(id: string): void {
    this.selected = this.selected.includes(id) ? this.selected.filter((s) => s !== id) : [...this.selected, id];
  }

  clearSelection(): void {
    this.selected = [];
  }
}

export const library = new LibraryState();
