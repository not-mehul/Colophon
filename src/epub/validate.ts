// EPUBCheck-style validation of the things that break books in readers:
// missing files, broken links, missing fonts and content documents that are
// not well-formed XHTML. Each issue carries a fix where one is safe to make.

import { text } from './archive';
import { fileText } from './draft';
import { basename, dirname, isExternal, relativePath, resolvePath, splitFragment } from './paths';
import type { Draft, Edition } from './types';
import { parseHtml, serialize, wellFormedError } from './xml';

export type IssueKind = 'container' | 'missing-file' | 'spine' | 'malformed' | 'broken-link' | 'missing-image' | 'missing-style' | 'missing-font';

export type Fix =
  /** Replace a file's text. */
  | { kind: 'patch'; label: string; path: string; text: string }
  /** Drop a manifest item whose file is missing. */
  | { kind: 'drop-item'; label: string; id: string }
  /** Nothing to do now: binding rewrites it. */
  | { kind: 'on-bind'; label: string };

export interface Issue {
  /** Stable across runs, for keyed lists. */
  key: string;
  kind: IssueKind;
  severity: 'fail' | 'warn';
  /** The file the problem is in. */
  path: string;
  title: string;
  detail: string;
  fix?: Fix;
}

const XHTML_TYPES = new Set(['application/xhtml+xml', 'text/html']);

/** The file names in the archive, so a broken link can be pointed at a file of the same name. */
function byBasename(paths: Iterable<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of paths) {
    const name = basename(p).toLowerCase();
    out.set(name, [...(out.get(name) ?? []), p]);
  }
  return out;
}

/** Rewrites one quoted attribute value everywhere it appears in `source`. */
function replaceAttr(source: string, attr: string, from: string, to: string | null): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\s${attr}\\s*=\\s*(["'])${escaped}\\1`, 'g');
  return source.replace(re, to === null ? '' : ` ${attr}="${to}"`);
}

/**
 * Re-parses a content document leniently and writes it back as well-formed
 * XHTML. Returns null if the result still isn't well formed.
 */
export function repairXhtml(source: string): string | null {
  const doc = parseHtml(source);
  // The HTML parser keeps xmlns declarations as plain attributes, and
  // XMLSerializer writes the XHTML namespace itself: drop them, or they double.
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) el.removeAttribute(attr.name);
    }
  }
  let out = serialize(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  // The HTML parser keeps epub:type as a plain attribute; declare its prefix.
  if (/\sepub:[a-z]/i.test(out) && !/xmlns:epub=/.test(out)) {
    out = out.replace(/<html\b/, '<html xmlns:epub="http://www.idpf.org/2007/ops"');
  }
  out = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n${out.replace(/^<!DOCTYPE[^>]*>\s*/i, '')}`;
  return wellFormedError(out) ? null : out;
}

const URL_IN_CSS = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

export function validate(edition: Edition, draft: Draft): Issue[] {
  const issues: Issue[] = [];
  const removed = new Set(draft.removed);
  const exists = (p: string) => edition.files.has(p) && !removed.has(p);
  const present = [...edition.files.keys()].filter(exists);
  const names = byBasename(present);
  const read = (p: string) => fileText(edition, draft, p, text);
  const dropped = new Set(draft.droppedItems);

  // The container.
  if (!edition.facts.mimetypeExists || !edition.facts.mimetypeValid || !edition.facts.mimetypeFirst) {
    issues.push({
      key: 'container:mimetype',
      kind: 'container',
      severity: edition.facts.mimetypeValid ? 'warn' : 'fail',
      path: 'mimetype',
      title: edition.facts.mimetypeExists ? 'The mimetype entry is not first and stored' : 'There is no mimetype entry',
      detail: 'Readers look for "application/epub+zip", uncompressed, at the start of the archive.',
      fix: { kind: 'on-bind', label: 'Rewritten when you bind' },
    });
  }
  if (!edition.facts.containerValid) {
    issues.push({
      key: 'container:xml',
      kind: 'container',
      severity: 'warn',
      path: 'META-INF/container.xml',
      title: 'META-INF/container.xml is missing or does not point at the package',
      detail: `Colophon found ${edition.opfPath} on its own.`,
      fix: { kind: 'on-bind', label: 'Rewritten when you bind' },
    });
  }

  // Manifest items whose files are gone, and spine entries with no item.
  for (const item of edition.manifest) {
    if (item.exists || dropped.has(item.id)) continue;
    issues.push({
      key: `missing:${item.id}`,
      kind: 'missing-file',
      severity: 'fail',
      path: edition.opfPath,
      title: `${item.href} is in the manifest but not in the archive`,
      detail: `Manifest item "${item.id}" (${item.mediaType || 'no media type'}).`,
      fix: { kind: 'drop-item', label: 'Remove from the manifest', id: item.id },
    });
  }
  const ids = new Set(edition.manifest.map((m) => m.id));
  for (const ref of edition.spine) {
    if (ids.has(ref.idref)) continue;
    issues.push({
      key: `spine:${ref.idref}`,
      kind: 'spine',
      severity: 'warn',
      path: edition.opfPath,
      title: `The spine lists "${ref.idref}", which the manifest does not`,
      detail: 'Readers skip it or refuse the book.',
      fix: { kind: 'on-bind', label: 'Removed from the spine when you bind' },
    });
  }

  // Content documents: well-formedness, then their links.
  const docs = edition.manifest.filter((m) => m.exists && !removed.has(m.path) && XHTML_TYPES.has(m.mediaType));
  for (const item of docs) {
    let source = read(item.path);
    const error = wellFormedError(source);
    if (error) {
      const repaired = repairXhtml(source);
      issues.push({
        key: `malformed:${item.path}`,
        kind: 'malformed',
        severity: 'fail',
        path: item.path,
        title: `${basename(item.path)} is not well-formed XHTML`,
        detail: error,
        fix: repaired ? { kind: 'patch', label: 'Rewrite as XHTML', path: item.path, text: repaired } : undefined,
      });
      if (repaired) source = repaired;
    }

    const dir = dirname(item.path);
    const seen = new Set<string>();
    for (const m of source.matchAll(/<(a|img|image|link|script|source|audio|video)\b[^>]*?\s(href|src|xlink:href)\s*=\s*(["'])([^"']*)\3/gi)) {
      const tag = m[1]!.toLowerCase();
      const attr = m[2]!;
      const href = m[4]!.trim();
      if (!href || href.startsWith('#') || isExternal(href) || seen.has(`${attr}|${href}`)) continue;
      seen.add(`${attr}|${href}`);
      const target = resolvePath(dir, href);
      if (exists(target)) continue;

      const [, fragment] = splitFragment(href);
      const candidate = names.get(basename(target).toLowerCase())?.[0];
      const repointed = candidate ? relativePath(dir, candidate) + (tag === 'a' ? fragment : '') : null;
      const kind: IssueKind = tag === 'a' ? 'broken-link' : tag === 'link' ? 'missing-style' : 'missing-image';
      let fix: Fix | undefined;
      if (repointed) {
        fix = { kind: 'patch', label: `Point at ${candidate}`, path: item.path, text: replaceAttr(source, attr, m[4]!, repointed) };
      } else if (tag === 'a') {
        fix = { kind: 'patch', label: 'Remove the link', path: item.path, text: replaceAttr(source, attr, m[4]!, null) };
      } else if (tag === 'link') {
        const escaped = m[4]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const stripped = source.replace(new RegExp(`<link\\b[^>]*?(["'])${escaped}\\1[^>]*>`, 'g'), '');
        fix = { kind: 'patch', label: 'Remove the stylesheet link', path: item.path, text: stripped };
      }
      issues.push({
        key: `${kind}:${item.path}:${href}`,
        kind,
        severity: tag === 'a' ? 'warn' : 'fail',
        path: item.path,
        title:
          kind === 'broken-link'
            ? `A link in ${basename(item.path)} goes nowhere`
            : kind === 'missing-style'
              ? `${basename(item.path)} links a stylesheet that is missing`
              : `${basename(item.path)} shows an image that is missing`,
        detail: href,
        fix,
      });
    }
  }

  // Stylesheets: fonts named in @font-face that are not in the archive.
  const sheets = edition.manifest.filter((m) => m.exists && !removed.has(m.path) && (m.mediaType === 'text/css' || m.path.endsWith('.css')));
  for (const sheet of sheets) {
    const source = read(sheet.path);
    const dir = dirname(sheet.path);
    for (const block of source.matchAll(/@font-face\s*\{[^}]*\}/gi)) {
      for (const url of block[0].matchAll(URL_IN_CSS)) {
        const href = url[2]!.trim();
        if (isExternal(href)) continue;
        const target = resolvePath(dir, href);
        if (exists(target)) continue;
        const candidate = names.get(basename(target).toLowerCase())?.[0];
        const fixed = candidate
          ? source.replace(block[0], block[0].replace(url[0], `url("${relativePath(dir, candidate)}")`))
          : source.replace(block[0], '');
        issues.push({
          key: `font:${sheet.path}:${href}`,
          kind: 'missing-font',
          severity: 'warn',
          path: sheet.path,
          title: `${basename(sheet.path)} names a font that is missing`,
          detail: href,
          fix: {
            kind: 'patch',
            label: candidate ? `Point at ${candidate}` : 'Remove the @font-face rule',
            path: sheet.path,
            text: fixed,
          },
        });
      }
    }
  }

  return issues;
}

/** Applies one fix to a draft, in place. */
export function applyFix(draft: Draft, fix: Fix): boolean {
  if (fix.kind === 'patch') {
    draft.patched[fix.path] = fix.text;
    return true;
  }
  if (fix.kind === 'drop-item') {
    if (!draft.droppedItems.includes(fix.id)) draft.droppedItems.push(fix.id);
    return true;
  }
  return false;
}

/**
 * Applies every safe fix. Fixes to one file are computed from its text at the
 * time, so this re-validates after each one rather than applying a stale batch.
 */
export function fixAll(edition: Edition, draft: Draft): number {
  let applied = 0;
  const tried = new Set<string>();
  for (let guard = 0; guard < 500; guard++) {
    const next = validate(edition, draft).find((i) => i.fix && i.fix.kind !== 'on-bind' && !tried.has(i.key));
    if (!next?.fix) break;
    tried.add(next.key);
    if (applyFix(draft, next.fix)) applied++;
  }
  return applied;
}
