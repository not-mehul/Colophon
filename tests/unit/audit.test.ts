import { describe, expect, it } from 'vitest';
import { inspectAccessibility } from '../../src/epub/accessibility';
import { runAudit, tierOf } from '../../src/epub/audit';
import { newDraft } from '../../src/epub/draft';
import { numberChapters } from '../../src/epub/filename';
import { openEpub } from '../../src/epub/open';
import type { Draft, Edition } from '../../src/epub/types';
import { validate } from '../../src/epub/validate';
import { epub2, epub3 } from './fixtures';

const audit = (edition: Edition, draft: Draft) =>
  runAudit(edition, draft, validate(edition, draft), inspectAccessibility(edition, draft), { minCoverWidth: 1000, exportName: 'x.epub' });

describe('the inspection', () => {
  it('scores out of 100 across seven checks', () => {
    const edition = openEpub(epub3());
    const result = audit(edition, newDraft(edition));
    expect(result.checks.map((c) => c.max).reduce((a, b) => a + b)).toBe(100);
    expect(result.score).toBe(100);
    expect(tierOf(result.score).name).toBe('Ready');
  });

  it('marks down the sample for what it lacks', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    const result = audit(edition, draft);
    const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
    expect(byId.cover!.items.map((i) => i.text)).toContain('Too small (300 × 450 px)');
    expect(byId.order!.items[0]!.status).toBe('warn');
    expect(byId.manifest!.items.find((i) => i.text.includes('not in the manifest'))).toBeTruthy();
    expect(byId.access!.items.map((i) => i.text)).toEqual(
      expect.arrayContaining(['1 image without alt text', '1 content document without a lang attribute']),
    );
    expect(result.score).toBeLessThan(85);
  });

  it('rises as the draft fixes things', () => {
    const edition = openEpub(epub2());
    const draft = newDraft(edition);
    const before = audit(edition, draft).score;
    draft.removed = [...edition.orphans];
    draft.chapters = numberChapters(draft.chapters, new Map(edition.chapters.map((c) => [c.id, c.title])));
    draft.meta.description = 'A short course in making digital books that behave on every reader.';
    const after = audit(edition, draft).score;
    expect(after).toBeGreaterThan(before);
  });
});
