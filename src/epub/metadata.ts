// Reading and writing the package document's <metadata>: the Dublin Core
// imprint, the series, and the EPUB Accessibility 1.1 discovery properties.

import type { A11yMeta, Meta } from './types';
import { allNamed, childrenNamed, firstNamed, NS, textOf } from './xml';

const ISBN_LIKE = /97[89][-\s]?\d|\b\d{9}[\dXx]\b|isbn/i;

export function metadataOf(doc: Document): Element | undefined {
  return firstNamed(doc, 'metadata');
}

function metas(doc: Document): Element[] {
  const metadata = metadataOf(doc);
  return metadata ? childrenNamed(metadata, 'meta') : [];
}

/** "2024-04-15T00:00:00Z" → "2024-04-15". */
function dateOnly(raw: string): string {
  return raw.includes('T') ? (raw.split('T')[0] ?? raw) : raw;
}

export function readMeta(doc: Document): Meta {
  const dc = (name: string) => allNamed(doc, name).filter((el) => el.namespaceURI === NS.dc || el.prefix === 'dc');
  const first = (name: string) => textOf(dc(name)[0]);
  const all = (name: string) => dc(name).map((el) => textOf(el)).filter(Boolean);

  const identifiers = all('identifier');
  const identifier = (identifiers.find((id) => ISBN_LIKE.test(id)) ?? identifiers[0] ?? '').replace(/^urn:isbn:/i, '');

  let series = '';
  let seriesIndex = '';
  for (const m of metas(doc)) {
    const name = (m.getAttribute('name') ?? '').toLowerCase();
    const property = (m.getAttribute('property') ?? '').toLowerCase();
    if (name === 'calibre:series') series ||= m.getAttribute('content') ?? '';
    else if (name === 'calibre:series_index') seriesIndex ||= m.getAttribute('content') ?? '';
    else if (property === 'belongs-to-collection') series ||= textOf(m);
    else if (property === 'group-position') seriesIndex ||= textOf(m);
  }

  return {
    title: first('title'),
    creator: all('creator').join(', '),
    identifier,
    language: first('language') || 'en',
    publisher: first('publisher'),
    date: dateOnly(first('date')),
    series,
    seriesIndex,
    subjects: all('subject'),
    description: first('description'),
  };
}

const A11Y_PROPS = {
  accessModes: 'schema:accessMode',
  accessModeSufficient: 'schema:accessModeSufficient',
  features: 'schema:accessibilityFeature',
  hazards: 'schema:accessibilityHazard',
} as const;

export function readA11y(doc: Document): A11yMeta {
  const out: A11yMeta = { accessModes: [], accessModeSufficient: [], features: [], hazards: [], summary: '', conformsTo: '' };
  for (const m of metas(doc)) {
    const key = m.getAttribute('property') ?? m.getAttribute('name') ?? '';
    const value = m.hasAttribute('property') ? textOf(m) : (m.getAttribute('content') ?? '').trim();
    if (!value) continue;
    for (const [field, property] of Object.entries(A11Y_PROPS) as [keyof typeof A11Y_PROPS, string][]) {
      if (key === property) out[field].push(...value.split(',').map((v) => v.trim()).filter(Boolean));
    }
    if (key === 'schema:accessibilitySummary') out.summary = value;
    if (key === 'dcterms:conformsTo') out.conformsTo = value;
  }
  for (const link of firstNamed(doc, 'metadata') ? childrenNamed(metadataOf(doc)!, 'link') : []) {
    if (link.getAttribute('rel') === 'dcterms:conformsTo') out.conformsTo ||= link.getAttribute('href') ?? '';
  }
  return out;
}

// ---------- writing ----------

function ensureMetadata(doc: Document): Element {
  let metadata = metadataOf(doc);
  if (!metadata) {
    metadata = doc.createElementNS(NS.opf, 'metadata');
    doc.documentElement.prepend(metadata);
  }
  if (!metadata.lookupNamespaceURI('dc')) metadata.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:dc', NS.dc);
  return metadata;
}

function dcElements(metadata: Element, name: string): Element[] {
  return childrenNamed(metadata, name).filter((el) => el.namespaceURI === NS.dc || el.prefix === 'dc');
}

function addDc(doc: Document, metadata: Element, name: string, value: string): Element {
  const el = doc.createElementNS(NS.dc, `dc:${name}`);
  el.textContent = value;
  metadata.appendChild(el);
  return el;
}

/** Replaces every dc:<name> with one element per value, keeping the first one's attributes. */
function setDc(doc: Document, metadata: Element, name: string, values: string[]): void {
  const existing = dcElements(metadata, name);
  const keep = existing[0];
  existing.slice(1).forEach((el) => el.remove());
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (!clean.length) {
    keep?.remove();
    return;
  }
  if (keep) keep.textContent = clean[0]!;
  else addDc(doc, metadata, name, clean[0]!);
  for (const value of clean.slice(1)) addDc(doc, metadata, name, value);
}

function newMeta(doc: Document, metadata: Element, epub3: boolean, property: string, value: string): Element {
  const el = doc.createElementNS(NS.opf, 'meta');
  if (epub3) {
    el.setAttribute('property', property);
    el.textContent = value;
  } else {
    el.setAttribute('name', property);
    el.setAttribute('content', value);
  }
  metadata.appendChild(el);
  return el;
}

function removeMetas(metadata: Element, test: (m: Element) => boolean): void {
  childrenNamed(metadata, 'meta').filter(test).forEach((m) => m.remove());
}

export function isEpub3(version: string): boolean {
  return Number.parseFloat(version) >= 3;
}

/**
 * Writes the imprint into the package document. `original` is what was read
 * when the edition opened, so the right dc:identifier is updated in place and
 * the package's unique-identifier keeps pointing at an element.
 */
export function writeMeta(doc: Document, meta: Meta, original: Meta, version: string, now = new Date()): void {
  const metadata = ensureMetadata(doc);
  const epub3 = isEpub3(version);

  setDc(doc, metadata, 'title', [meta.title || 'Untitled']);
  setDc(doc, metadata, 'creator', meta.creator.split(','));
  setDc(doc, metadata, 'language', [meta.language || 'en']);
  setDc(doc, metadata, 'publisher', [meta.publisher]);
  setDc(doc, metadata, 'date', [meta.date]);
  setDc(doc, metadata, 'description', [meta.description]);
  setDc(doc, metadata, 'subject', meta.subjects);

  // Identifier: update the one that was shown, or add one the package can point at.
  const identifier = meta.identifier.trim();
  const ids = dcElements(metadata, 'identifier');
  const shown = ids.find((el) => textOf(el).replace(/^urn:isbn:/i, '') === original.identifier) ?? (original.identifier ? undefined : ids[0]);
  if (identifier) {
    if (shown) {
      shown.textContent = /^urn:isbn:/i.test(textOf(shown)) ? `urn:isbn:${identifier}` : identifier;
    } else if (!ids.some((el) => textOf(el).replace(/^urn:isbn:/i, '') === identifier)) {
      const el = addDc(doc, metadata, 'identifier', identifier);
      const pkg = doc.documentElement;
      const uid = pkg.getAttribute('unique-identifier');
      if (!uid || !ids.some((other) => other.getAttribute('id') === uid)) {
        el.setAttribute('id', uid || 'BookId');
        pkg.setAttribute('unique-identifier', uid || 'BookId');
      }
    }
  }

  // Series: calibre's tags, read by most readers, plus EPUB 3's collection.
  removeMetas(metadata, (m) => {
    const name = m.getAttribute('name');
    const property = m.getAttribute('property');
    return name === 'calibre:series' || name === 'calibre:series_index' || property === 'belongs-to-collection' || (property === 'group-position' && (m.getAttribute('refines') ?? '').startsWith('#colophon-series'));
  });
  if (meta.series.trim()) {
    const series = doc.createElementNS(NS.opf, 'meta');
    series.setAttribute('name', 'calibre:series');
    series.setAttribute('content', meta.series.trim());
    metadata.appendChild(series);
    if (meta.seriesIndex.trim()) {
      const index = doc.createElementNS(NS.opf, 'meta');
      index.setAttribute('name', 'calibre:series_index');
      index.setAttribute('content', meta.seriesIndex.trim());
      metadata.appendChild(index);
    }
    if (epub3) {
      const collection = newMeta(doc, metadata, true, 'belongs-to-collection', meta.series.trim());
      collection.setAttribute('id', 'colophon-series');
      if (meta.seriesIndex.trim()) {
        newMeta(doc, metadata, true, 'group-position', meta.seriesIndex.trim()).setAttribute('refines', '#colophon-series');
      }
    }
  }

  // EPUB 3 requires the last-modified date.
  if (epub3) {
    removeMetas(metadata, (m) => m.getAttribute('property') === 'dcterms:modified');
    newMeta(doc, metadata, true, 'dcterms:modified', `${now.toISOString().slice(0, 19)}Z`);
  }
}

/** Replaces the accessibility discovery metadata. */
export function writeA11y(doc: Document, a11y: A11yMeta, version: string): void {
  const metadata = ensureMetadata(doc);
  const epub3 = isEpub3(version);
  const props = new Set<string>([...Object.values(A11Y_PROPS), 'schema:accessibilitySummary', 'dcterms:conformsTo']);
  removeMetas(metadata, (m) => props.has(m.getAttribute('property') ?? m.getAttribute('name') ?? ''));
  childrenNamed(metadata, 'link')
    .filter((l) => l.getAttribute('rel') === 'dcterms:conformsTo')
    .forEach((l) => l.remove());

  for (const [field, property] of Object.entries(A11Y_PROPS) as [keyof typeof A11Y_PROPS, string][]) {
    const values = a11y[field];
    // EPUB 3 repeats the property; EPUB 2 has one <meta> with a list.
    if (epub3) values.forEach((v) => newMeta(doc, metadata, true, property, v));
    else if (values.length) newMeta(doc, metadata, false, property, values.join(', '));
  }
  if (a11y.summary.trim()) newMeta(doc, metadata, epub3, 'schema:accessibilitySummary', a11y.summary.trim());
  if (a11y.conformsTo.trim()) newMeta(doc, metadata, epub3, 'dcterms:conformsTo', a11y.conformsTo.trim());
}
