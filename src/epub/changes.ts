// The proof: every change the draft makes to the edition, said plainly, each
// with a way to put that one thing back. changeCount() is the length of this
// list, so the badge on Bind and the proof never disagree.

import { basename } from './paths';
import { renames, orderChanged } from './draft';
import type { Draft, Edition, Meta, TocEntry } from './types';

export type ChangeGroup = 'imprint' | 'cover' | 'chapters' | 'repairs';

export interface Change {
  /** Stable within one draft: "meta:title", "order", "patch:OEBPS/ch1.xhtml". */
  id: string;
  group: ChangeGroup;
  label: string;
  /** How it reads in the file as opened. Empty when there was nothing. */
  before: string;
  /** How it will read once bound. */
  after: string;
  /** Puts this one thing back as it was in the edition, leaving the rest of the draft alone. */
  revert: (draft: Draft) => void;
}

export const GROUP_LABELS: Record<ChangeGroup, string> = {
  imprint: 'Imprint',
  cover: 'Cover',
  chapters: 'Chapters and contents',
  repairs: 'Repairs',
};

const META_LABELS: [keyof Omit<Meta, 'subjects'>, string][] = [
  ['title', 'Title'],
  ['creator', 'Author'],
  ['identifier', 'Identifier'],
  ['language', 'Language'],
  ['publisher', 'Publisher'],
  ['date', 'Publication date'],
  ['series', 'Series'],
  ['seriesIndex', 'Number in series'],
  ['description', 'Synopsis'],
];

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
const megabytes = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** A long value cut at a word, for the proof. */
export function excerpt(value: string, max = 90): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : max).trimEnd()}…`;
}

function tocChanged(a: TocEntry[], b: TocEntry[]): boolean {
  return a.length !== b.length || a.some((e, i) => e.label !== b[i]?.label || e.target !== b[i]?.target || e.depth !== b[i]?.depth);
}

function coverTags(epub2: boolean, epub3: boolean): string {
  if (epub2 && epub3) return 'EPUB 2 and EPUB 3';
  if (epub3) return 'EPUB 3 only';
  if (epub2) return 'EPUB 2 only';
  return 'Untagged';
}

export function describeChanges(edition: Edition, draft: Draft): Change[] {
  const out: Change[] = [];
  const was = edition.meta;

  for (const [key, label] of META_LABELS) {
    const before = was[key] || '';
    const after = draft.meta[key] || '';
    if (before === after) continue;
    out.push({
      id: `meta:${key}`,
      group: 'imprint',
      label,
      before: key === 'description' ? excerpt(before) : before,
      after: key === 'description' ? excerpt(after) : after,
      revert: (d) => (d.meta[key] = was[key]),
    });
  }
  if (draft.meta.subjects.join('\n') !== was.subjects.join('\n')) {
    out.push({
      id: 'meta:subjects',
      group: 'imprint',
      label: 'Subjects',
      before: was.subjects.join(', '),
      after: draft.meta.subjects.join(', '),
      revert: (d) => (d.meta.subjects = [...was.subjects]),
    });
  }

  const cover = edition.cover;
  if (draft.cover) {
    out.push({
      id: 'cover',
      group: 'cover',
      label: 'Cover image',
      before: cover ? `${cover.width} × ${cover.height} px` : '',
      after: `${draft.cover.width} × ${draft.cover.height} px`,
      revert: (d) => (d.cover = null),
    });
  }
  if (draft.dualCoverTags && cover && !(cover.epub2 && cover.epub3)) {
    out.push({
      id: 'cover-tags',
      group: 'cover',
      label: 'Cover tags',
      before: coverTags(cover.epub2, cover.epub3),
      after: coverTags(true, true),
      revert: (d) => (d.dualCoverTags = false),
    });
  }

  if (orderChanged(edition, draft)) {
    const moved = draft.chapters.filter((c, i) => edition.chapters[i]?.id !== c.id).length;
    const original = edition.chapters.map((c) => c.id);
    out.push({
      id: 'order',
      group: 'chapters',
      label: 'Reading order',
      before: `${plural(edition.chapters.length, 'chapter')} as opened`,
      after: `${plural(moved, 'chapter')} in a new place`,
      revert: (d) => {
        const byId = new Map(d.chapters.map((c) => [c.id, c]));
        d.chapters = original.map((id) => byId.get(id)).filter((c) => !!c);
      },
    });
  }
  const renamed = renames(draft);
  if (renamed.size) {
    const [first] = renamed;
    out.push({
      id: 'renames',
      group: 'chapters',
      label: 'File names',
      before: basename(first![0]) + (renamed.size > 1 ? ` and ${plural(renamed.size - 1, 'other')}` : ''),
      after: basename(first![1]) + (renamed.size > 1 ? ` and ${plural(renamed.size - 1, 'other')}` : ''),
      revert: (d) => {
        for (const c of d.chapters) c.fileName = basename(c.path);
      },
    });
  }
  if (draft.toc && tocChanged(draft.toc, edition.toc)) {
    out.push({
      id: 'toc',
      group: 'chapters',
      label: 'Table of contents',
      before: edition.toc.length ? plural(edition.toc.length, 'entry', 'entries') : '',
      after: plural(draft.toc.length, 'entry', 'entries'),
      revert: (d) => (d.toc = null),
    });
  }

  if (draft.removed.length) {
    out.push({
      id: 'removed',
      group: 'repairs',
      label: 'Orphan files',
      before: `${plural(draft.removed.length, 'file')} in the archive`,
      after: 'Left out',
      revert: (d) => (d.removed = []),
    });
  }
  if (draft.droppedItems.length) {
    out.push({
      id: 'dropped',
      group: 'repairs',
      label: 'Missing manifest items',
      before: `${plural(draft.droppedItems.length, 'item')} listed`,
      after: 'Dropped from the manifest',
      revert: (d) => (d.droppedItems = []),
    });
  }
  for (const path of Object.keys(draft.patched)) {
    out.push({
      id: `patch:${path}`,
      group: 'repairs',
      label: basename(path),
      before: 'As opened',
      after: 'Mended (language, alt text or markup)',
      revert: (d) => {
        const next = { ...d.patched };
        delete next[path];
        d.patched = next;
      },
    });
  }
  const shrunk = Object.keys(draft.images ?? {});
  if (shrunk.length) {
    const before = shrunk.reduce((n, p) => n + (edition.files.get(p)?.byteLength ?? 0), 0);
    const after = shrunk.reduce((n, p) => n + (draft.images![p]?.byteLength ?? 0), 0);
    out.push({
      id: 'images',
      group: 'repairs',
      label: plural(shrunk.length, 'image') + ' shrunk',
      before: megabytes(before),
      after: megabytes(after),
      revert: (d) => (d.images = {}),
    });
  }
  if (draft.a11y) {
    const features = draft.a11y.features.length;
    out.push({
      id: 'a11y',
      group: 'repairs',
      label: 'Accessibility metadata',
      before: edition.a11y.accessModes.length ? 'Declared' : '',
      after: [draft.a11y.conformsTo ? 'WCAG 2.2 AA' : '', plural(features, 'feature')].filter(Boolean).join(', '),
      revert: (d) => (d.a11y = null),
    });
  }
  return out;
}
