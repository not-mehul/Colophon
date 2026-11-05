// XML helpers over the platform DOMParser (the app's WebView, or jsdom in tests).

export const NS = {
  opf: 'http://www.idpf.org/2007/opf',
  dc: 'http://purl.org/dc/elements/1.1/',
  xhtml: 'http://www.w3.org/1999/xhtml',
  epub: 'http://www.idpf.org/2007/ops',
  ncx: 'http://www.daisy.org/z3986/2005/ncx/',
  container: 'urn:oasis:names:tc:opendocument:xmlns:container',
} as const;

export class XmlError extends Error {}

/** The parser's complaint if `doc` failed to parse, else null. */
function parseErrorOf(doc: Document): string | null {
  const error = doc.getElementsByTagName('parsererror')[0];
  if (!error) return null;
  return (error.textContent ?? 'malformed XML').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** Parses strict XML. Throws XmlError with the parser's message when it isn't well formed. */
export function parseXml(source: string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  const error = parseErrorOf(doc);
  if (error) throw new XmlError(error);
  return doc;
}

/** Null when `source` is well-formed XML, otherwise the parser's message. */
export function wellFormedError(source: string): string | null {
  return parseErrorOf(new DOMParser().parseFromString(source, 'application/xml'));
}

export function parseHtml(source: string): Document {
  return new DOMParser().parseFromString(source, 'text/html');
}

export function serialize(doc: Document): string {
  const out = new XMLSerializer().serializeToString(doc);
  return out.startsWith('<?xml') ? out : `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;
}

/** Child elements of `parent` with this local name, in any namespace. */
export function childrenNamed(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((el) => el.localName === localName);
}

/** All descendants with this local name, in any namespace. */
export function allNamed(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', localName));
}

export function firstNamed(root: Document | Element, localName: string): Element | undefined {
  return allNamed(root, localName)[0];
}

export const textOf = (el: Element | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Escapes text for an XML text node or attribute value. */
export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
