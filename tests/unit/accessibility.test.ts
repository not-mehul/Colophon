import { describe, expect, it } from 'vitest';
import { addLang, inspectAccessibility, sortTocBySpine, suggestA11y, tocFollowsSpine, writeAltText } from '../../src/epub/accessibility';
import { newDraft } from '../../src/epub/draft';
import { openEpub } from '../../src/epub/open';
import { epub2, epub3 } from './fixtures';

describe('the accessibility ledger', () => {
  it('finds images without alt text and documents without a language', () => {
    const edition = openEpub(epub2());
    const report = inspectAccessibility(edition, newDraft(edition));
    expect(report.imageCount).toBe(1);
    expect(report.missingAlt).toEqual([{ doc: 'OEBPS/text/draft_folio_b.xhtml', index: 0, image: 'OEBPS/images/ornament.jpg' }]);
    expect(report.missingLang).toEqual(['OEBPS/text/09_colophon_notes.xhtml']);
    expect(report.readingOrder).toBe(true);
    expect(report.missingMetadata).toEqual(['access modes', 'features', 'hazards', 'a summary']);
  });

  it('is clean for the builder', () => {
    const edition = openEpub(epub3());
    const report = inspectAccessibility(edition, newDraft(edition));
    expect(report.missingLang).toEqual([]);
    expect(report.missingMetadata).toEqual([]);
  });

  it('writes alt text and lang', () => {
    const src = '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><img src="a.jpg"/><img src="b.jpg" alt=""/></body></html>';
    expect(writeAltText(src, new Map([[0, 'A fountain pen']]))).toContain('alt="A fountain pen"');
    expect(addLang(src, 'fr')).toContain('<html xmlns="http://www.w3.org/1999/xhtml" lang="fr" xml:lang="fr">');
    expect(addLang('<html lang="en">', 'fr')).toBe('<html lang="en" xml:lang="fr">');
  });

  it('notices a contents list that jumps around, and sorts it', () => {
    const toc = [
      { label: 'Two', target: 'b.xhtml', depth: 0 },
      { label: 'Two, part', target: 'b.xhtml#p', depth: 1 },
      { label: 'One', target: 'a.xhtml', depth: 0 },
    ];
    expect(tocFollowsSpine(toc, ['a.xhtml', 'b.xhtml'])).toBe(false);
    expect(sortTocBySpine(toc, ['a.xhtml', 'b.xhtml']).map((e) => e.label)).toEqual(['One', 'Two', 'Two, part']);
  });

  it('suggests honest discovery metadata', () => {
    const edition = openEpub(epub2());
    const report = inspectAccessibility(edition, newDraft(edition));
    const meta = suggestA11y(edition, report, true);
    expect(meta.accessModes).toEqual(['textual', 'visual']);
    expect(meta.features).not.toContain('alternativeText');
    expect(meta.conformsTo).toBe('');
    expect(meta.summary).toMatch(/some images lack/);
  });
});
