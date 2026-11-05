import { describe, expect, it } from 'vitest';
import { addLang, inspectAccessibility, suggestA11y } from '../../src/epub/accessibility';
import { readZip, text } from '../../src/epub/archive';
import { bind, rewriteLinks } from '../../src/epub/bind';
import { newDraft } from '../../src/epub/draft';
import { numberChapters } from '../../src/epub/filename';
import { openEpub } from '../../src/epub/open';
import { tocFromChapters } from '../../src/epub/toc';
import { fixAll, validate } from '../../src/epub/validate';
import { brokenEpub, epub2, epub3, fakeJpeg } from './fixtures';

describe('binding', () => {
  it('writes the imprint and reads back the same', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    draft.meta = {
      ...draft.meta,
      title: 'The Art & Craft of Bookmaking',
      creator: 'Clara Vance, Ines Oduya',
      identifier: '9780141439518',
      publisher: 'Meridian Press',
      date: '2024-04-15',
      series: 'Modern Publishing Guides',
      seriesIndex: '2',
      subjects: ['Typography'],
      description: 'A course in <em>careful</em> books.',
    };
    const again = openEpub(bind(edition, draft));
    expect(again.meta).toEqual({ ...draft.meta, language: 'en' });
    // The original identifier stays the package's unique identifier.
    expect(again.opfXml).toMatch(/<dc:identifier id="BookId">urn:uuid:colophon-specimen-2026<\/dc:identifier>|unique-identifier="BookId"/);
  });

  it('keeps the mimetype first and stored, and writes a container when one is missing', () => {
    const edition = openEpub(brokenEpub());
    const out = bind(edition, newDraft(edition));
    const { files, facts } = readZip(out);
    expect(facts).toEqual({ firstEntry: 'mimetype', firstStored: true });
    expect(text(files.get('META-INF/container.xml'))).toContain('full-path="content.opf"');
    expect(openEpub(out).facts).toEqual({ mimetypeExists: true, mimetypeValid: true, mimetypeFirst: true, containerValid: true });
  });

  it('renames chapters, reorders the spine and follows the links', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    draft.chapters = [draft.chapters[2]!, draft.chapters[0]!, draft.chapters[1]!];
    draft.chapters = numberChapters(draft.chapters, new Map(edition.chapters.map((c) => [c.id, c.title])));
    const again = openEpub(bind(edition, draft));
    expect(again.chapters.map((c) => c.path)).toEqual([
      'OEBPS/text/chapter_001_iii-the-printer-s-colophon-a.xhtml',
      'OEBPS/text/chapter_002_i-foundations-of-digital-boo.xhtml',
      'OEBPS/text/chapter_003_ii-proportion-and-responsive.xhtml',
    ]);
    // The NCX still reaches every chapter.
    expect(again.toc.map((e) => e.target).sort()).toEqual(again.chapters.map((c) => c.path).sort());
    expect(validate(again, newDraft(again)).filter((i) => i.kind === 'broken-link')).toEqual([]);
  });

  it('rewrites links to renamed files and keeps fragments', () => {
    const moved = new Map([['OEBPS/text/a.xhtml', 'OEBPS/text/001.xhtml']]);
    expect(rewriteLinks('<a href="a.xhtml#n1">x</a> <a href="https://a.xhtml">y</a>', 'OEBPS/text/', moved)).toBe(
      '<a href="001.xhtml#n1">x</a> <a href="https://a.xhtml">y</a>',
    );
  });

  it('replaces the cover and writes both tags', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    draft.cover = { bytes: fakeJpeg(1600, 2400), mediaType: 'image/jpeg', width: 1600, height: 2400 };
    const again = openEpub(bind(edition, draft));
    expect(again.cover).toMatchObject({ width: 1600, height: 2400, epub2: true, path: 'OEBPS/images/cover.jpg' });
  });

  it('adds a cover to a book without one', () => {
    const edition = openEpub(brokenEpub());
    const draft = newDraft(edition);
    draft.cover = { bytes: fakeJpeg(1200, 1800), mediaType: 'image/jpeg', width: 1200, height: 1800 };
    const again = openEpub(bind(edition, draft));
    expect(again.cover).toMatchObject({ path: 'images/cover.jpg', epub2: true, epub3: true });
  });

  it('removes orphans, drops missing items and applies fixes', () => {
    const edition = openEpub(brokenEpub());
    const draft = newDraft(edition);
    fixAll(edition, draft);
    const again = openEpub(bind(edition, draft));
    const left = validate(again, newDraft(again)).map((i) => i.kind);
    expect(left).toEqual(['missing-image']);
  });

  it('writes an edited table of contents into the NCX', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    draft.toc = [
      { label: 'Opening', target: edition.chapters[0]!.path, depth: 0 },
      { label: 'Measure', target: `${edition.chapters[1]!.path}#m`, depth: 1 },
    ];
    const again = openEpub(bind(edition, draft));
    expect(again.toc).toEqual(draft.toc);
    expect(text(again.files.get('OEBPS/toc.ncx'))).toContain('<content src="text/draft_folio_b.xhtml#m"/>');
  });

  it('writes an edited table of contents into the nav, nested', () => {
    const edition = openEpub(epub3());
    const draft = newDraft(edition);
    draft.toc = [
      { label: 'Part one', target: edition.chapters[1]!.path, depth: 0 },
      { label: 'Heads', target: edition.chapters[2]!.path, depth: 1 },
    ];
    const again = openEpub(bind(edition, draft));
    expect(again.toc).toEqual(draft.toc);
    expect(text(again.files.get(again.navPath))).toMatch(/<li><a href="text\/001_gutters.xhtml">Part one<\/a><ol><li>/);
  });

  it('creates a table of contents for a book with none', () => {
    const edition = openEpub(brokenEpub());
    const draft = newDraft(edition);
    fixAll(edition, draft);
    draft.toc = tocFromChapters(edition.chapters);
    const again = openEpub(bind(edition, draft));
    expect(again.navPath).toBe('nav.xhtml');
    expect(again.ncxPath).toBe('toc.ncx');
    expect(again.toc.map((e) => e.label)).toEqual(['A', 'B']);
  });

  it('writes accessibility metadata and lang attributes', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    const report = inspectAccessibility(edition, draft);
    for (const path of report.missingLang) draft.patched[path] = addLang(text(edition.files.get(path)), 'en');
    draft.a11y = suggestA11y(edition, report, true);
    const again = openEpub(bind(edition, draft));
    const after = inspectAccessibility(again, newDraft(again));
    expect(after.missingLang).toEqual([]);
    expect(after.missingMetadata).toEqual([]);
    expect(again.opfXml).toContain('<meta name="schema:accessMode" content="textual, visual"/>');
  });

  it('updates dcterms:modified on EPUB 3', () => {
    const edition = openEpub(epub3());
    const out = openEpub(bind(edition, newDraft(edition), { now: new Date('2026-11-04T10:00:00Z') }));
    expect(out.opfXml.match(/dcterms:modified/g)).toHaveLength(1);
    expect(out.opfXml).toContain('2026-11-04T10:00:00Z');
  });
});
