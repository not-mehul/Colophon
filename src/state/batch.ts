// Batch fixes over editions picked on the library bench (long press). Each
// edition is opened, fixed, bound and stored again; Undo puts the old files back.

import { bind } from '../epub/bind';
import { newDraft } from '../epub/draft';
import { formatFileName, numberChapters } from '../epub/filename';
import { openEpub } from '../epub/open';
import { fixAll } from '../epub/validate';
import { thumbnail } from '../render/image';
import { bench } from './bench.svelte';
import { db, type StoredEdition } from './db';
import { library } from './library.svelte';
import { settings } from './settings.svelte';

export interface BatchFixes {
  coverTags: boolean;
  orphans: boolean;
  number: boolean;
  validation: boolean;
  rename: boolean;
}

export const BATCH_FIXES: { id: keyof BatchFixes; label: string; hint: string }[] = [
  { id: 'coverTags', label: 'Write both cover tags', hint: 'The EPUB 2 meta and the EPUB 3 cover-image property.' },
  { id: 'orphans', label: 'Remove orphan files', hint: 'Files in the archive that the manifest does not list.' },
  { id: 'number', label: 'Number chapter files', hint: 'Renames chapter files so they sort in reading order.' },
  { id: 'validation', label: 'Apply safe validation fixes', hint: 'Repairs XHTML, points broken links at the right file.' },
  { id: 'rename', label: 'Apply the file name template', hint: 'Names each bound file from its imprint.' },
];

export interface BatchResult {
  done: number;
  failed: string[];
  undo: () => Promise<void>;
}

export async function runBatch(ids: string[], fixes: BatchFixes, onProgress?: (done: number) => void): Promise<BatchResult> {
  const before: { row: StoredEdition; bytes: Uint8Array }[] = [];
  const failed: string[] = [];
  let done = 0;
  for (const id of ids) {
    const row = library.get(id);
    const bytes = await library.bytes(id);
    if (!row || !bytes) continue;
    try {
      const edition = openEpub(bytes, row.fileName);
      const draft = row.draft ?? newDraft(edition);
      if (fixes.validation) fixAll(edition, draft);
      if (fixes.number) {
        const titles = new Map(edition.chapters.map((c) => [c.id, c.title]));
        draft.chapters = numberChapters(draft.chapters, titles, { pattern: settings.value.renamePattern });
      }
      if (fixes.coverTags) draft.dualCoverTags = true;
      const out = bind(edition, draft, {
        level: settings.value.compression,
        dualCoverTags: fixes.coverTags || settings.value.dualCoverTags,
        purgeOrphans: fixes.orphans,
      });
      const reopened = openEpub(out, row.fileName);
      const fileName = fixes.rename ? formatFileName(settings.value.exportTemplate, reopened.meta, settings.value.shelfOrder) : row.fileName;
      before.push({ row, bytes });
      await library.update(
        id,
        {
          fileName,
          title: reopened.meta.title,
          creator: reopened.meta.creator,
          score: bench.scoreOf(reopened, newDraft(reopened)),
          size: out.byteLength,
          draft: null,
          thumb: reopened.cover ? await thumbnail(reopened.cover.bytes, reopened.cover.mediaType) : row.thumb,
        },
        out,
      );
      done++;
      onProgress?.(done);
    } catch {
      failed.push(row.title || row.fileName);
    }
  }
  return {
    done,
    failed,
    undo: async () => {
      await db.transaction('rw', db.editions, db.bytes, async () => {
        await db.editions.bulkPut(before.map((b) => b.row));
        await db.bytes.bulkPut(before.map((b) => ({ id: b.row.id, bytes: b.bytes })));
      });
      await library.load();
    },
  };
}
