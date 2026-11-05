// The edition on the bench: the Edition as opened, the Draft of edits over
// it, and what follows from both (the inspection, validation and the bound
// file's name). Edits are saved to the library as they happen.

import { addLang, inspectAccessibility, sortTocBySpine, suggestA11y, writeAltText } from '../epub/accessibility';
import { text } from '../epub/archive';
import { runAudit, tierOf, TIERS, type Audit } from '../epub/audit';
import { describeChanges } from '../epub/changes';
import { bind } from '../epub/bind';
import { changeCount, cloneDraft, effectiveCover, effectiveToc, newDraft, remainingOrphans } from '../epub/draft';
import { formatFileName, numberChapters } from '../epub/filename';
import { imageMime, imageSize } from '../epub/image-size';
import { openEpub } from '../epub/open';
import { tocFromChapters } from '../epub/toc';
import type { Draft, Edition, Meta, TocEntry } from '../epub/types';
import { applyFix, fixAll, validate, type Fix } from '../epub/validate';
import { tap } from '../platform/haptics';
import { saveFile, shareFile } from '../platform/output';
import { thumbnail } from '../render/image';
import { library } from './library.svelte';
import { settings } from './settings.svelte';
import { ui } from './ui.svelte';

const EPUB_MIME = 'application/epub+zip';
const SAVE_DELAY_MS = 600;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function emptyDraft(): Draft {
  return {
    meta: { title: '', creator: '', identifier: '', language: 'en', publisher: '', date: '', series: '', seriesIndex: '', subjects: [], description: '' },
    chapters: [],
    toc: null,
    cover: null,
    dualCoverTags: false,
    removed: [],
    droppedItems: [],
    patched: {},
    a11y: null,
  };
}

class BenchState {
  id = $state<string | null>(null);
  edition = $state.raw<Edition | null>(null);
  draft = $state<Draft>(emptyDraft());
  busy = $state<'opening' | 'binding' | null>(null);

  issues = $derived(this.edition ? validate(this.edition, this.draft) : []);
  access = $derived(this.edition ? inspectAccessibility(this.edition, this.draft) : null);
  exportName = $derived(formatFileName(settings.value.exportTemplate, this.draft.meta, settings.value.shelfOrder));
  audit: Audit = $derived(
    this.edition && this.access
      ? runAudit(this.edition, this.draft, this.issues, this.access, { minCoverWidth: settings.value.minCoverWidth, exportName: this.exportName })
      : { score: 0, checks: [] },
  );
  changes = $derived(this.edition ? changeCount(this.edition, this.draft) : 0);
  /** Every change, said plainly, each with its own revert (the proof sheet). */
  proof = $derived(this.edition ? describeChanges(this.edition, this.draft) : []);
  /** The inspection of the file as opened (or as last bound), before any edit. */
  baseline: Audit = $derived(this.edition ? this.auditOf(this.edition, newDraft(this.edition)) : { score: 0, checks: [] });
  /** Points the edits have added (or cost) since the file was opened. */
  gain = $derived(this.edition ? this.audit.score - this.baseline.score : 0);
  /** The check with the most points still to win, for "Most to gain". */
  nextGain = $derived(
    this.audit.checks
      .filter((c) => c.score < c.max)
      .reduce<Audit['checks'][number] | null>((best, c) => (!best || c.max - c.score > best.max - best.score ? c : best), null),
  );
  cover = $derived(this.edition ? effectiveCover(this.edition, this.draft) : null);
  toc: TocEntry[] = $derived(this.edition ? effectiveToc(this.edition, this.draft) : []);
  orphans = $derived(this.edition ? remainingOrphans(this.edition, this.draft) : []);
  /** Chapter titles by manifest id. */
  titles = $derived(new Map((this.edition?.chapters ?? []).map((c) => [c.id, c.title])));

  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  // ---------- opening and closing ----------

  /** Opens bytes from a file, the sample or the builder, and adds them to the library. */
  async openBytes(bytes: Uint8Array, fileName: string): Promise<boolean> {
    this.busy = 'opening';
    try {
      const edition = openEpub(bytes, fileName);
      const draft = newDraft(edition);
      const score = this.scoreOf(edition, draft);
      const id = await library.add(
        {
          fileName,
          title: edition.meta.title,
          creator: edition.meta.creator,
          score,
          thumb: edition.cover ? await thumbnail(edition.cover.bytes, edition.cover.mediaType) : null,
          size: bytes.byteLength,
          openedAt: Date.now(),
          boundAt: null,
          savedPath: null,
          draft: null,
        },
        bytes,
      );
      this.show(id, edition, draft);
      return true;
    } catch (err) {
      ui.notify(`Couldn't read that EPUB (${err instanceof Error ? err.message : String(err)}). Check that it is a valid .epub file.`, 'error');
      return false;
    } finally {
      this.busy = null;
    }
  }

  /** Opens an edition from the library, with its unsaved edits. */
  async openStored(id: string): Promise<boolean> {
    const stored = library.get(id);
    const bytes = await library.bytes(id);
    if (!stored || !bytes) {
      ui.notify("That edition is no longer in the library.", 'error');
      return false;
    }
    try {
      const edition = openEpub(bytes, stored.fileName);
      const draft = stored.draft && this.fits(stored.draft, edition) ? stored.draft : newDraft(edition);
      await library.update(id, { openedAt: Date.now() });
      this.show(id, edition, draft);
      return true;
    } catch (err) {
      ui.notify(`Couldn't reopen ${stored.fileName} (${err instanceof Error ? err.message : String(err)}).`, 'error');
      return false;
    }
  }

  /** A stored draft only applies to the same chapters. */
  private fits(draft: Draft, edition: Edition): boolean {
    const ids = new Set(edition.chapters.map((c) => c.id));
    return draft.chapters.length === edition.chapters.length && draft.chapters.every((c) => ids.has(c.id));
  }

  private show(id: string, edition: Edition, draft: Draft): void {
    this.flush();
    this.lastTier = -1;
    this.edition = edition;
    this.draft = draft;
    this.id = id;
    ui.go('inspection');
    void settings.update({ lastEditionId: id });
  }

  close(): void {
    this.flush();
    this.edition = null;
    this.id = null;
    this.draft = emptyDraft();
    void settings.update({ lastEditionId: null });
  }

  // ---------- saving edits ----------

  auditOf(edition: Edition, draft: Draft): Audit {
    const access = inspectAccessibility(edition, draft);
    const exportName = formatFileName(settings.value.exportTemplate, draft.meta, settings.value.shelfOrder);
    return runAudit(edition, draft, validate(edition, draft), access, { minCoverWidth: settings.value.minCoverWidth, exportName });
  }

  scoreOf(edition: Edition, draft: Draft): number {
    return this.auditOf(edition, draft).score;
  }

  /** The tier last seen for this edition, so a rise can be felt (a haptic tap) once. */
  private lastTier = -1;

  /** Called whenever the score changes: a light tap when an edit lifts the edition into a better tier. */
  noteTier(): void {
    const index = TIERS.indexOf(tierOf(this.audit.score));
    if (this.lastTier !== -1 && index < this.lastTier) tap();
    this.lastTier = index;
  }

  // ---------- the proof ----------

  /** Puts one change back, with Undo. */
  revertChange(id: string): void {
    const change = this.proof.find((c) => c.id === id);
    if (!change) return;
    this.withUndo(`${change.label} put back as it was.`, () => change.revert(this.draft));
  }

  /** Puts every change back, with Undo. */
  revertAll(): void {
    const edition = this.edition;
    if (!edition || !this.changes) return;
    this.withUndo(`${plural(this.proof.length, 'change')} put back. The edition is as it was opened.`, () => {
      this.draft = newDraft(edition);
    });
  }

  /** Saves the draft to the library shortly after the last edit. */
  touch(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  flush(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const id = this.id;
    if (!id || !this.edition) return;
    const draft = this.changes ? ($state.snapshot(this.draft) as Draft) : null;
    void library.saveDraft(id, draft, this.audit.score).catch((err) => console.warn('Could not save edits', err));
    const meta = this.draft.meta;
    void library.update(id, { title: meta.title, creator: meta.creator }).catch(() => undefined);
  }

  /** Runs an edit with an undo toast that puts the draft back as it was. */
  withUndo(message: string | (() => string), edit: () => void): void {
    const before = cloneDraft($state.snapshot(this.draft) as Draft);
    edit();
    this.touch();
    ui.undoable(typeof message === 'function' ? message() : message, () => {
      this.draft = before;
      this.touch();
    });
  }

  // ---------- imprint and cover ----------

  setMeta<K extends keyof Meta>(key: K, value: Meta[K]): void {
    this.draft.meta[key] = value;
    this.touch();
  }

  resetImprint(): void {
    const edition = this.edition;
    if (!edition) return;
    this.withUndo('Imprint and cover reverted to the original.', () => {
      this.draft.meta = { ...edition.meta, subjects: [...edition.meta.subjects] };
      this.draft.cover = null;
    });
  }

  importFields(fields: Partial<Meta>, source: string): void {
    const count = Object.keys(fields).length;
    this.withUndo(`Imported ${plural(count, 'field')} from ${source}.`, () => {
      Object.assign(this.draft.meta, fields);
    });
  }

  async setCover(bytes: Uint8Array, mediaType = imageMime(bytes)): Promise<void> {
    const { width, height } = imageSize(bytes);
    const before = this.draft.cover;
    this.draft.cover = { bytes, mediaType, width, height };
    this.touch();
    if (this.id) {
      const thumb = await thumbnail(bytes, mediaType);
      if (thumb) void library.update(this.id, { thumb });
    }
    ui.undoable(`Cover replaced (${width} × ${height} px).`, () => {
      this.draft.cover = before;
      this.touch();
    });
  }

  fixCoverTags(): void {
    this.draft.dualCoverTags = true;
    this.touch();
    ui.notify('Both the EPUB 2 and EPUB 3 cover tags will be written.', 'success');
  }

  // ---------- chapters and contents ----------

  moveChapter(from: number, to: number): void {
    const list = this.draft.chapters;
    if (from === to || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    this.touch();
  }

  renameChapter(index: number, name: string): void {
    const chapter = this.draft.chapters[index];
    // eslint-disable-next-line no-control-regex
    const clean = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim();
    if (!chapter) return;
    chapter.fileName = clean || chapter.path.slice(chapter.path.lastIndexOf('/') + 1);
    this.touch();
  }

  sortChapters(by: 'title' | 'name' | 'reverse'): void {
    const labels = { title: 'Sorted by chapter heading.', name: 'Sorted by file name.', reverse: 'Reading order reversed.' };
    this.withUndo(labels[by], () => {
      if (by === 'reverse') this.draft.chapters.reverse();
      else if (by === 'title') this.draft.chapters.sort((a, b) => (this.titles.get(a.id) ?? '').localeCompare(this.titles.get(b.id) ?? '', undefined, { numeric: true }));
      else this.draft.chapters.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    });
  }

  resetChapters(): void {
    const edition = this.edition;
    if (!edition) return;
    this.withUndo('Order, file names and contents reset.', () => {
      this.draft.chapters = newDraft(edition).chapters;
      this.draft.toc = null;
    });
  }

  numberChapters(pattern: string, start: number, digits: number): void {
    this.withUndo(`Numbered ${plural(this.draft.chapters.length, 'chapter file')}.`, () => {
      this.draft.chapters = numberChapters(this.draft.chapters, this.titles, { pattern, start, digits });
    });
    void settings.update({ renamePattern: pattern });
  }

  setToc(entries: TocEntry[]): void {
    this.draft.toc = entries;
    this.touch();
  }

  /** Puts the contents in reading order. */
  orderToc(): void {
    const order = this.draft.chapters.map((c) => c.path);
    this.withUndo('Contents put in reading order.', () => {
      this.draft.toc = sortTocBySpine(this.toc, order);
    });
  }

  rebuildToc(): void {
    const edition = this.edition;
    if (!edition) return;
    const byId = new Map(edition.chapters.map((c) => [c.id, c]));
    this.withUndo('Contents rebuilt from the chapters.', () => {
      this.draft.toc = tocFromChapters(this.draft.chapters.filter((c) => c.linear).map((c) => byId.get(c.id)!).filter(Boolean));
    });
  }

  // ---------- inspection fixes ----------

  removeOrphans(): void {
    const edition = this.edition;
    if (!edition || !this.orphans.length) return;
    const count = this.orphans.length;
    this.withUndo(`Removed ${plural(count, 'orphan file')}.`, () => {
      this.draft.removed = [...new Set([...this.draft.removed, ...edition.orphans])];
    });
  }

  applyFix(fix: Fix): void {
    this.withUndo(fix.kind === 'drop-item' ? 'Removed from the manifest.' : 'Fixed.', () => {
      applyFix(this.draft, fix);
    });
  }

  fixAll(): void {
    const edition = this.edition;
    if (!edition) return;
    let count = 0;
    this.withUndo(
      () => (count ? `Applied ${plural(count, 'fix', 'fixes')}.` : 'Nothing left that Colophon can fix safely.'),
      () => {
        count = fixAll(edition, this.draft);
      },
    );
  }

  addLanguage(): void {
    const edition = this.edition;
    const docs = this.access?.missingLang ?? [];
    if (!edition || !docs.length) return;
    const lang = this.draft.meta.language || 'en';
    this.withUndo(`Declared “${lang}” on ${plural(docs.length, 'content document')}.`, () => {
      for (const path of docs) this.draft.patched[path] = addLang(this.draft.patched[path] ?? text(edition.files.get(path)), lang);
    });
  }

  /** Writes alt text, by content document and image position. */
  setAltText(alts: Map<string, Map<number, string>>): number {
    const edition = this.edition;
    if (!edition) return 0;
    let written = 0;
    let skipped = 0;
    this.withUndo(() => `Alt text written for ${plural(written, 'image')}.`, () => {
      for (const [doc, byIndex] of alts) {
        const next = writeAltText(this.draft.patched[doc] ?? text(edition.files.get(doc)), byIndex);
        if (next === null) skipped++;
        else {
          this.draft.patched[doc] = next;
          written += byIndex.size;
        }
      }
    });
    if (skipped) ui.notify(`Fix the XHTML in ${plural(skipped, 'document')} first, then add its alt text.`, 'error');
    return written;
  }

  suggestedA11y() {
    if (!this.edition || !this.access) return null;
    return suggestA11y(this.edition, this.access, this.toc.length > 0);
  }

  // ---------- binding ----------

  /** Binds the draft into a new EPUB, saves it, and puts the bound copy on the bench. */
  async bindAndSave(): Promise<void> {
    const edition = this.edition;
    const id = this.id;
    if (!edition || !id || this.busy) return;
    this.busy = 'binding';
    try {
      const bytes = bind(edition, $state.snapshot(this.draft) as Draft, {
        level: settings.value.compression,
        dualCoverTags: settings.value.dualCoverTags,
        purgeOrphans: settings.value.purgeOrphans,
      });
      const name = this.exportName;
      const stored = library.get(id);
      const saved = await saveFile({ name, data: bytes, mime: EPUB_MIME }, stored?.savedPath ?? null);
      const reopened = openEpub(bytes, name);
      const draft = newDraft(reopened);
      const score = this.scoreOf(reopened, draft);
      const cover = reopened.cover;
      await library.update(
        id,
        {
          fileName: name,
          title: reopened.meta.title,
          creator: reopened.meta.creator,
          score,
          size: bytes.byteLength,
          boundAt: Date.now(),
          savedPath: saved.path || stored?.savedPath || null,
          draft: null,
          thumb: cover ? await thumbnail(cover.bytes, cover.mediaType) : null,
        },
        bytes,
      );
      this.edition = reopened;
      this.draft = draft;
      ui.notify(`Bound and saved to ${saved.label.replace(/\/[^/]*$/, '')}.`, 'success', saved.uri ? { label: 'Share', run: () => void this.share() } : undefined);
    } catch (err) {
      ui.notify(`Couldn't bind the EPUB (${err instanceof Error ? err.message : String(err)}). Your edits are still here; try again.`, 'error');
    } finally {
      this.busy = null;
    }
  }

  /** Shares the edition as it stands: bound with the current edits. */
  async share(): Promise<void> {
    const edition = this.edition;
    if (!edition) return;
    try {
      const bytes = this.changes
        ? bind(edition, $state.snapshot(this.draft) as Draft, { level: settings.value.compression, dualCoverTags: settings.value.dualCoverTags, purgeOrphans: settings.value.purgeOrphans })
        : ((await library.bytes(this.id!)) ?? bind(edition, $state.snapshot(this.draft) as Draft));
      await shareFile({ name: this.exportName, data: bytes, mime: EPUB_MIME }, this.draft.meta.title || 'EPUB');
    } catch (err) {
      ui.notify(`Couldn't share the EPUB (${err instanceof Error ? err.message : String(err)}).`, 'error');
    }
  }
}

export const bench = new BenchState();
