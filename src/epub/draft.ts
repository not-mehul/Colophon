// A Draft holds the reader's edits over an Edition. These helpers make one,
// count what it changes, and describe the edition as it would be bound.

import { basename, dirname } from './paths';
import type { Draft, Edition, Meta, TocEntry } from './types';

export function cloneMeta(meta: Meta): Meta {
  return { ...meta, subjects: [...meta.subjects] };
}

export function newDraft(edition: Edition): Draft {
  return {
    meta: cloneMeta(edition.meta),
    chapters: edition.chapters.map((c) => ({ id: c.id, path: c.path, fileName: basename(c.path), linear: c.linear })),
    toc: null,
    cover: null,
    dualCoverTags: false,
    removed: [],
    droppedItems: [],
    patched: {},
    a11y: null,
  };
}

/** A deep copy, for undo snapshots. */
export function cloneDraft(draft: Draft): Draft {
  return {
    ...draft,
    meta: cloneMeta(draft.meta),
    chapters: draft.chapters.map((c) => ({ ...c })),
    toc: draft.toc?.map((e) => ({ ...e })) ?? null,
    removed: [...draft.removed],
    droppedItems: [...draft.droppedItems],
    patched: { ...draft.patched },
    images: { ...draft.images },
    a11y: draft.a11y && {
      ...draft.a11y,
      accessModes: [...draft.a11y.accessModes],
      accessModeSufficient: [...draft.a11y.accessModeSufficient],
      features: [...draft.a11y.features],
      hazards: [...draft.a11y.hazards],
    },
  };
}

const META_FIELDS = ['title', 'creator', 'identifier', 'language', 'publisher', 'date', 'series', 'seriesIndex', 'description'] as const;

/** Chapter files whose names change: old zip path → new zip path. */
export function renames(draft: Draft): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of draft.chapters) {
    const next = dirname(c.path) + c.fileName;
    if (next !== c.path) out.set(c.path, next);
  }
  return out;
}

export function orderChanged(edition: Edition, draft: Draft): boolean {
  return draft.chapters.some((c, i) => edition.chapters[i]?.id !== c.id);
}

function tocChanged(a: TocEntry[], b: TocEntry[]): boolean {
  return a.length !== b.length || a.some((e, i) => e.label !== b[i]?.label || e.target !== b[i]?.target || e.depth !== b[i]?.depth);
}

/** How many separate things the draft changes, for the badge on "Bind". */
export function changeCount(edition: Edition, draft: Draft): number {
  let n = META_FIELDS.filter((k) => (draft.meta[k] || '') !== (edition.meta[k] || '')).length;
  if (draft.meta.subjects.join('\n') !== edition.meta.subjects.join('\n')) n++;
  if (draft.cover) n++;
  if (draft.dualCoverTags && edition.cover && !(edition.cover.epub2 && edition.cover.epub3)) n++;
  if (orderChanged(edition, draft)) n++;
  if (renames(draft).size) n++;
  if (draft.toc && tocChanged(draft.toc, edition.toc)) n++;
  if (draft.removed.length) n++;
  if (draft.droppedItems.length) n++;
  n += Object.keys(draft.patched).length;
  if (Object.keys(draft.images ?? {}).length) n++;
  if (draft.a11y) n++;
  return n;
}

/** The cover as it will be bound. */
export function effectiveCover(edition: Edition, draft: Draft) {
  const original = edition.cover;
  if (draft.cover) {
    return { ...draft.cover, epub2: true, epub3: true, replaced: true };
  }
  if (!original) return null;
  return {
    bytes: original.bytes,
    mediaType: original.mediaType,
    width: original.width,
    height: original.height,
    epub2: original.epub2 || draft.dualCoverTags,
    epub3: original.epub3 || draft.dualCoverTags,
    replaced: false,
  };
}

/** The table of contents as it will be bound, following renamed chapters. */
export function effectiveToc(edition: Edition, draft: Draft): TocEntry[] {
  return draft.toc ?? edition.toc;
}

/** Orphan files still in the archive. */
export function remainingOrphans(edition: Edition, draft: Draft): string[] {
  const removed = new Set(draft.removed);
  return edition.orphans.filter((p) => !removed.has(p));
}

/** A file's text as it will be bound. */
export function fileText(edition: Edition, draft: Draft, path: string, decode: (b: Uint8Array | undefined) => string): string {
  return draft.patched[path] ?? decode(edition.files.get(path));
}
