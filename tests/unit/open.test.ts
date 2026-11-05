import { describe, expect, it } from 'vitest';
import { readZip } from '../../src/epub/archive';
import { openEpub } from '../../src/epub/open';
import { brokenEpub, epub2, epub3 } from './fixtures';

describe('opening an EPUB 2', () => {
  const edition = openEpub(epub2(), 'sample.epub');

  it('reads the container and the package', () => {
    expect(edition.facts).toEqual({ mimetypeExists: true, mimetypeValid: true, mimetypeFirst: true, containerValid: true });
    expect(edition.opfPath).toBe('OEBPS/content.opf');
    expect(edition.version).toBe('2.0');
  });

  it('reads the imprint', () => {
    expect(edition.meta.title).toBe('The Art of Digital Bookmaking');
    expect(edition.meta.creator).toBe('Clara Vance');
    expect(edition.meta.date).toBe('2024');
    expect(edition.meta.subjects).toEqual(['Typography', 'Book Design']);
    expect(edition.meta.identifier).toBe('urn:uuid:colophon-specimen-2026');
  });

  it('reads chapters, the cover, orphans and the NCX', () => {
    expect(edition.chapters.map((c) => c.title)).toEqual([
      'I. Foundations of Digital Bookmaking',
      'II. Proportion and Responsive Measure',
      "III. The Printer's Colophon and Imprint",
    ]);
    expect(edition.totalWords).toBeGreaterThan(100);
    expect(edition.cover).toMatchObject({ id: 'cover-img', width: 300, height: 450, epub2: true, epub3: false });
    expect(edition.orphans).toEqual(['OEBPS/extras/printer_scratch_note.txt']);
    expect(edition.ncxPath).toBe('OEBPS/toc.ncx');
    expect(edition.toc).toHaveLength(3);
    expect(edition.toc[0]).toEqual({ label: 'I. Foundations of Digital Bookmaking', target: 'OEBPS/text/zz_opening_leaf.xhtml', depth: 0 });
  });
});

describe('opening an EPUB 3', () => {
  const edition = openEpub(epub3());

  it('reads the nav, the cover property and the accessibility metadata', () => {
    expect(edition.version).toBe('3.0');
    expect(edition.navPath).toBe('OEBPS/nav.xhtml');
    expect(edition.toc.map((e) => e.label)).toEqual(['Gutters', 'Heads and feet']);
    expect(edition.cover).toMatchObject({ width: 1600, height: 2400, epub2: true, epub3: true });
    expect(edition.meta.creator).toBe('Iris Holt, Tomas Reyes');
    expect(edition.a11y.accessModes).toEqual(['textual']);
    expect(edition.a11y.features).toContain('tableOfContents');
    expect(edition.a11y.summary).toMatch(/reflowable/);
  });

  it('writes the mimetype entry first and stored', () => {
    expect(readZip(epub3()).facts).toEqual({ firstEntry: 'mimetype', firstStored: true });
  });
});

describe('opening a broken EPUB', () => {
  const edition = openEpub(brokenEpub(), 'broken.epub');

  it('still opens, and records what is wrong', () => {
    expect(edition.facts.mimetypeExists).toBe(false);
    expect(edition.facts.containerValid).toBe(false);
    expect(edition.opfPath).toBe('content.opf');
    expect(edition.manifest.find((m) => m.id === 'gone')?.exists).toBe(false);
    expect(edition.chapters.map((c) => c.id)).toEqual(['a', 'b']);
    expect(edition.cover).toBeNull();
    expect(edition.toc).toEqual([]);
  });

  it('refuses what is not a zip', () => {
    expect(() => openEpub(new TextEncoder().encode('not a zip'))).toThrow(/not a zip/);
  });
});
