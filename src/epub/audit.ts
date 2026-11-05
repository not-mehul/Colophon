// The inspection: seven checks, each worth part of 100, over the edition as
// it would be bound now.

import type { A11yReport } from './accessibility';
import { effectiveCover, effectiveToc, remainingOrphans } from './draft';
import { namedInOrder } from './filename';
import { isEpub3 } from './metadata';
import type { Issue } from './validate';
import type { Draft, Edition } from './types';

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type CheckId = 'container' | 'imprint' | 'cover' | 'contents' | 'manifest' | 'order' | 'access';
export type CheckTab = 'imprint' | 'chapters' | 'catalog' | 'inspection';

export interface CheckItem {
  status: CheckStatus;
  text: string;
}

export interface Check {
  id: CheckId;
  title: string;
  score: number;
  max: number;
  items: CheckItem[];
  /** Where to go to work on it. */
  action?: { label: string; tab: CheckTab };
}

export interface Audit {
  score: number;
  checks: Check[];
}

export interface AuditOptions {
  /** Width that earns full marks for the cover; height is 1.5× (2:3). */
  minCoverWidth: number;
  exportName: string;
}

export interface Tier {
  min: number;
  name: string;
  /** CSS custom property for the tier colour. */
  cssVar: string;
  verdict: string;
  hint: string;
}

export const TIERS: readonly Tier[] = [
  { min: 85, name: 'Ready', cssVar: '--scale-1', verdict: 'Ready to shelve', hint: 'The container, imprint, cover and reading order all meet the reference checks.' },
  { min: 72, name: 'Sound', cssVar: '--scale-2', verdict: 'Sound, with small gaps', hint: 'Well formed. The ledger below lists the optional fixes.' },
  { min: 58, name: 'Readable', cssVar: '--scale-3', verdict: 'Readable, needs polish', hint: 'It opens everywhere, but the cover, file order or imprint need attention.' },
  { min: 42, name: 'Weak', cssVar: '--scale-4', verdict: 'Needs repair', hint: 'Work through the Imprint, Chapters and Catalog tabs to finish this edition.' },
  { min: -Infinity, name: 'Broken', cssVar: '--scale-5', verdict: 'Needs repair', hint: 'Start with the validation list: some readers will refuse this file.' },
];

/** Characters of synopsis that earn the imprint its synopsis marks. */
export const SYNOPSIS_MIN = 30;

export function tierOf(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]!;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

export function runAudit(edition: Edition, draft: Draft, issues: Issue[], access: A11yReport, options: AuditOptions): Audit {
  const checks: Check[] = [];
  const { meta } = draft;

  // 1. Archive and container: 15.
  {
    const items: CheckItem[] = [];
    let score = 0;
    const { mimetypeExists, mimetypeValid, mimetypeFirst, containerValid } = edition.facts;
    if (mimetypeExists && mimetypeValid && mimetypeFirst) {
      score += 8;
      items.push({ status: 'pass', text: 'The mimetype entry is first and uncompressed' });
    } else if (mimetypeValid) {
      score += 5;
      items.push({ status: 'warn', text: 'The mimetype entry is not first or is compressed (fixed when you bind)' });
    } else {
      items.push({ status: 'fail', text: 'The mimetype entry is missing or malformed (fixed when you bind)' });
    }
    if (containerValid) {
      score += 7;
      items.push({ status: 'pass', text: `The container points to ${edition.opfPath}` });
    } else {
      score += 2;
      items.push({ status: 'warn', text: 'META-INF/container.xml is missing or incomplete' });
    }
    checks.push({ id: 'container', title: 'Archive and container', score, max: 15, items });
  }

  // 2. Imprint: 22.
  {
    const items: CheckItem[] = [];
    let score = 0;
    if (meta.title.trim()) {
      score += 6;
      items.push({ status: 'pass', text: `Title: ${meta.title.trim().slice(0, 40)}` });
    } else items.push({ status: 'fail', text: 'No title (<dc:title>)' });
    if (meta.creator.trim()) {
      score += 5;
      items.push({ status: 'pass', text: `Author: ${meta.creator.trim().slice(0, 40)}` });
    } else items.push({ status: 'fail', text: 'No author (<dc:creator>)' });
    if (meta.identifier.trim()) {
      score += 4;
      items.push({ status: 'pass', text: `Identifier: ${meta.identifier.trim()}` });
    } else items.push({ status: 'warn', text: 'No ISBN or other identifier' });
    if (meta.description.trim().length >= SYNOPSIS_MIN) {
      score += 4;
      items.push({ status: 'pass', text: `Synopsis (${plural(meta.description.trim().length, 'character')})` });
    } else items.push({ status: 'warn', text: 'The synopsis is missing or very short' });
    if (meta.publisher.trim() && meta.subjects.length) {
      score += 3;
      items.push({ status: 'pass', text: `Publisher and ${plural(meta.subjects.length, 'subject')}` });
    } else items.push({ status: 'warn', text: 'The publisher or subjects are missing' });
    checks.push({ id: 'imprint', title: 'Imprint', score, max: 22, items, action: { label: 'Edit imprint', tab: 'imprint' } });
  }

  // 3. Cover: 20.
  {
    const items: CheckItem[] = [];
    let score = 0;
    const cover = effectiveCover(edition, draft);
    const minW = options.minCoverWidth;
    const minH = Math.round(minW * 1.5);
    if (cover) {
      score += 7;
      const { width: w, height: h } = cover;
      if (w >= minW && h >= minH * 0.93) {
        score += 7;
        items.push({ status: 'pass', text: `Large enough (${w} × ${h} px)` });
      } else if (w >= 600 && h >= 800) {
        score += 3;
        items.push({ status: 'warn', text: `Smaller than ideal (${w} × ${h} px; ${minW} × ${minH} preferred)` });
      } else items.push({ status: 'warn', text: `Too small (${w} × ${h} px)` });
      const ratio = w > 0 ? h / w : 0;
      if (ratio >= 1.3 && ratio <= 1.75) {
        score += 2;
        items.push({ status: 'pass', text: `Portrait (1 : ${ratio.toFixed(2)})` });
      } else items.push({ status: 'warn', text: `Unusual proportions (1 : ${ratio.toFixed(2)})` });
      if (cover.epub2 && (cover.epub3 || !isEpub3(edition.version))) {
        score += 4;
        items.push({ status: 'pass', text: isEpub3(edition.version) ? 'Tagged for both EPUB 2 and EPUB 3' : 'Tagged with <meta name="cover">' });
      } else {
        score += 2;
        items.push({ status: 'warn', text: 'Tagged for one EPUB version only' });
      }
    } else items.push({ status: 'fail', text: 'No cover' });
    checks.push({ id: 'cover', title: 'Cover', score, max: 20, items, action: { label: 'Edit the cover', tab: 'imprint' } });
  }

  // 4. Spine and contents: 13.
  {
    const items: CheckItem[] = [];
    let score = 0;
    const count = draft.chapters.length;
    if (count) {
      score += 7;
      items.push({ status: 'pass', text: `${plural(count, 'chapter')} in the spine` });
    } else items.push({ status: 'fail', text: 'No chapters in the spine' });
    const toc = effectiveToc(edition, draft);
    const kinds = [edition.navPath && 'Nav', edition.ncxPath && 'NCX'].filter(Boolean).join(' + ');
    if (toc.length) {
      score += 6;
      items.push({ status: 'pass', text: `Table of contents, ${plural(toc.length, 'entry', 'entries')}${kinds ? ` (${kinds})` : ' (written when you bind)'}` });
    } else items.push({ status: 'warn', text: 'No table of contents (nav or NCX)' });
    checks.push({ id: 'contents', title: 'Spine and contents', score, max: 13, items, action: { label: 'Edit contents', tab: 'chapters' } });
  }

  // 5. Manifest and links: 10.
  {
    const items: CheckItem[] = [];
    let score = 0;
    const dropped = new Set(draft.droppedItems);
    const missing = edition.manifest.filter((m) => !m.exists && !dropped.has(m.id)).length;
    const listed = edition.manifest.length - dropped.size;
    if (!missing) {
      score += 4;
      items.push({ status: 'pass', text: `All ${plural(listed, 'manifest file')} present` });
    } else items.push({ status: 'fail', text: `${plural(missing, 'manifest file')} missing` });
    const orphans = remainingOrphans(edition, draft).length;
    if (!orphans) {
      score += 2;
      items.push({ status: 'pass', text: 'No orphan files' });
    } else items.push({ status: 'warn', text: `${plural(orphans, 'file')} not in the manifest` });
    const malformed = issues.filter((i) => i.kind === 'malformed').length;
    const links = issues.filter((i) => i.kind === 'broken-link' || i.kind === 'missing-image' || i.kind === 'missing-style').length;
    const fonts = issues.filter((i) => i.kind === 'missing-font').length;
    if (!malformed) {
      score += 2;
      items.push({ status: 'pass', text: 'Every content document is well-formed XHTML' });
    } else items.push({ status: 'fail', text: `${plural(malformed, 'content document')} not well-formed` });
    if (!links && !fonts) {
      score += 2;
      items.push({ status: 'pass', text: 'Links, images, stylesheets and fonts all resolve' });
    } else {
      items.push({
        status: 'warn',
        text: [links && plural(links, 'broken link'), fonts && plural(fonts, 'missing font')].filter(Boolean).join(' and '),
      });
    }
    checks.push({ id: 'manifest', title: 'Manifest and links', score, max: 10, items });
  }

  // 6. Chapter order: 8.
  {
    const items: CheckItem[] = [];
    let score = 0;
    if (namedInOrder(draft.chapters)) {
      score += 8;
      items.push({ status: 'pass', text: 'Chapter files are named in reading order' });
    } else {
      score += 3;
      items.push({ status: 'warn', text: 'Chapter file names are out of sequence' });
    }
    items.push({ status: 'pass', text: `Binds as ${options.exportName}` });
    checks.push({ id: 'order', title: 'Chapter order', score, max: 8, items, action: { label: 'Number the files', tab: 'chapters' } });
  }

  // 7. Accessibility: 12.
  {
    const items: CheckItem[] = [];
    let score = 0;
    if (!access.imageCount) {
      score += 4;
      items.push({ status: 'pass', text: 'No images in the text' });
    } else if (!access.missingAlt.length) {
      score += 4;
      items.push({ status: 'pass', text: `Alt text on all ${plural(access.imageCount, 'image')}` });
    } else {
      score += access.missingAlt.length < access.imageCount ? 2 : 0;
      items.push({ status: 'warn', text: `${plural(access.missingAlt.length, 'image')} without alt text` });
    }
    if (!access.missingLang.length) {
      score += 3;
      items.push({ status: 'pass', text: 'Every content document declares its language' });
    } else items.push({ status: 'warn', text: `${plural(access.missingLang.length, 'content document')} without a lang attribute` });
    if (access.readingOrder) {
      score += 2;
      items.push({ status: 'pass', text: 'The contents follow the reading order' });
    } else items.push({ status: 'warn', text: 'The contents jump around the reading order' });
    const missing = access.missingMetadata.length;
    if (!missing) {
      score += 3;
      items.push({ status: 'pass', text: access.metadata.conformsTo ? `Declares ${access.metadata.conformsTo}` : 'Accessibility metadata present' });
    } else {
      score += missing < 4 ? 1 : 0;
      items.push({ status: 'warn', text: `No accessibility metadata for ${access.missingMetadata.join(', ')}` });
    }
    checks.push({ id: 'access', title: 'Accessibility', score, max: 12, items });
  }

  return { score: checks.reduce((sum, c) => sum + c.score, 0), checks };
}
