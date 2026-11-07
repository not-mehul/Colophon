import { describe, expect, it } from 'vitest';
import { describeChanges, excerpt } from '../../src/epub/changes';
import { changeCount, newDraft } from '../../src/epub/draft';
import { numberChapters } from '../../src/epub/filename';
import { openEpub } from '../../src/epub/open';
import { epub2, epub3, fakeJpeg } from './fixtures';

describe('the proof', () => {
  it('is empty for an untouched edition', () => {
    const edition = openEpub(epub3());
    expect(describeChanges(edition, newDraft(edition))).toEqual([]);
  });

  it('lists each change with the value as opened and as bound, and agrees with the count', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    draft.meta.title = 'A New Title';
    draft.meta.publisher = 'Hairline Press';
    draft.meta.subjects = ['Craft'];
    draft.cover = { bytes: fakeJpeg(1600, 2400), mediaType: 'image/jpeg', width: 1600, height: 2400 };
    draft.chapters.reverse();
    draft.removed = [...edition.orphans];
    draft.patched[edition.chapters[0]!.path] = '<html/>';
    const titles = new Map(edition.chapters.map((c) => [c.id, c.title]));
    draft.chapters = numberChapters(draft.chapters, titles, { pattern: 'chapter_{num}', start: 1, digits: 3 });

    const proof = describeChanges(edition, draft);
    expect(proof).toHaveLength(changeCount(edition, draft));
    const title = proof.find((c) => c.id === 'meta:title')!;
    expect(title.before).toBe(edition.meta.title);
    expect(title.after).toBe('A New Title');
    expect(proof.find((c) => c.id === 'cover')!.after).toBe('1600 × 2400 px');
    expect(proof.map((c) => c.group)).toEqual(expect.arrayContaining(['imprint', 'cover', 'chapters', 'repairs']));
  });

  it('puts back one change and leaves the rest', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    draft.meta.title = 'Changed';
    draft.chapters.reverse();
    const titles = new Map(edition.chapters.map((c) => [c.id, c.title]));
    draft.chapters = numberChapters(draft.chapters, titles, { pattern: 'chapter_{num}', start: 1, digits: 3 });

    describeChanges(edition, draft).find((c) => c.id === 'order')!.revert(draft);
    expect(draft.chapters.map((c) => c.id)).toEqual(edition.chapters.map((c) => c.id));
    // The new file names stay with their chapters.
    expect(draft.chapters.some((c) => c.fileName.startsWith('chapter_'))).toBe(true);
    expect(draft.meta.title).toBe('Changed');

    describeChanges(edition, draft).find((c) => c.id === 'renames')!.revert(draft);
    describeChanges(edition, draft).find((c) => c.id === 'meta:title')!.revert(draft);
    expect(describeChanges(edition, draft)).toEqual([]);
    expect(changeCount(edition, draft)).toBe(0);
  });

  it('cuts a long synopsis at a word', () => {
    expect(excerpt('short')).toBe('short');
    const long = excerpt('word '.repeat(60));
    expect(long.length).toBeLessThanOrEqual(91);
    expect(long.endsWith('word…')).toBe(true);
  });
});
