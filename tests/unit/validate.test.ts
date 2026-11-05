import { describe, expect, it } from 'vitest';
import { newDraft } from '../../src/epub/draft';
import { openEpub } from '../../src/epub/open';
import { fixAll, repairXhtml, validate } from '../../src/epub/validate';
import { wellFormedError } from '../../src/epub/xml';
import { brokenEpub, epub3 } from './fixtures';

describe('validation', () => {
  it('finds nothing wrong with a clean EPUB 3', () => {
    const edition = openEpub(epub3());
    expect(validate(edition, newDraft(edition))).toEqual([]);
  });

  it('finds each kind of problem in the broken EPUB', () => {
    const edition = openEpub(brokenEpub());
    const kinds = validate(edition, newDraft(edition)).map((i) => `${i.kind}:${i.detail.slice(0, 20)}`);
    expect(kinds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^container:/),
        expect.stringMatching(/^missing-file:/),
        expect.stringMatching(/^spine:/),
        expect.stringMatching(/^malformed:/),
        'broken-link:nowhere.xhtml#x',
        'broken-link:old/a.xhtml',
        'missing-image:pic.png',
        'missing-style:style/missing.css',
        'missing-font:../fonts/Gone.ttf',
      ]),
    );
    // The font that is present is not reported.
    expect(kinds.some((k) => k.includes('Body.woff2'))).toBe(false);
  });

  it('offers fixes that clear the problems they are for', () => {
    const edition = openEpub(brokenEpub());
    const draft = newDraft(edition);
    const before = validate(edition, draft);
    const moved = before.find((i) => i.detail === 'old/a.xhtml');
    expect(moved?.fix?.label).toBe('Point at a.xhtml');

    expect(fixAll(edition, draft)).toBeGreaterThanOrEqual(6);
    const after = validate(edition, draft);
    // Left: the container (rewritten when binding) and the missing image (no file to point at).
    expect(after.map((i) => i.kind).sort()).toEqual(['container', 'container', 'missing-image', 'spine']);
    expect(draft.droppedItems).toEqual(['gone']);
    expect(draft.patched['b.xhtml']).toContain('href="a.xhtml"');
    expect(draft.patched['b.xhtml']).not.toContain('nowhere.xhtml');
    expect(draft.patched['b.xhtml']).not.toContain('missing.css');
    expect(draft.patched['style/book.css']).not.toContain('Gone.ttf');
    expect(wellFormedError(draft.patched['a.xhtml']!)).toBeNull();
  });

  it('repairs tag soup into well-formed XHTML, keeping epub:type', () => {
    const out = repairXhtml('<html><body><p>One<br><p epub:type="note">Two &nbsp; three</body></html>');
    expect(out).not.toBeNull();
    expect(wellFormedError(out!)).toBeNull();
    expect(out).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
    expect(out).toContain('<br />');
  });
});
