// ISBNs: cleaning, checking and converting, for barcodes and search.

/** Digits (and a final X) only. */
export function cleanIsbn(value: string): string {
  return value.replace(/^urn:isbn:/i, '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, d, i) => acc + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
  return sum % 11 === 0;
}

export function isIsbn(value: string): boolean {
  const isbn = cleanIsbn(value);
  return isValidIsbn13(isbn) || isValidIsbn10(isbn);
}

export function isbn10to13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return core + ((10 - (sum % 10)) % 10);
}

/**
 * The ISBN in a scanned barcode, or null. Book barcodes are EAN-13 starting
 * 978 or 979; anything else (a price add-on, a UPC) is not an ISBN.
 */
export function isbnFromBarcode(code: string): string | null {
  const digits = cleanIsbn(code);
  if (isValidIsbn13(digits) && /^97[89]/.test(digits)) return digits;
  if (isValidIsbn10(digits)) return isbn10to13(digits);
  return null;
}

/** "9780141439518" → "978-0-14-143951-8" is publisher-specific; this groups only the prefix. */
export function formatIsbn(isbn: string): string {
  const clean = cleanIsbn(isbn);
  return clean.length === 13 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

/** The check digit an ISBN-13 should end with, from its first twelve digits. */
export function isbn13CheckDigit(first12: string): string {
  const sum = [...first12.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

/** The check digit an ISBN-10 should end with ("X" for ten), from its first nine digits. */
export function isbn10CheckDigit(first9: string): string {
  const sum = [...first9.slice(0, 9)].reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

export type IdentifierCheck =
  | { kind: 'empty' }
  | { kind: 'isbn13'; isbn: string }
  | { kind: 'isbn10'; isbn: string; as13: string }
  | { kind: 'bad-check'; length: 10 | 13; expected: string; corrected: string }
  | { kind: 'not-isbn' };

/**
 * What an identifier is, for the hint under the field: a sound ISBN, one
 * with a wrong check digit (and the digit it should have), or something else
 * (a UUID, a publisher's own code), which is fine but isn't an ISBN.
 */
export function checkIdentifier(value: string): IdentifierCheck {
  const raw = value.trim();
  if (!raw) return { kind: 'empty' };
  // Only digits, hyphens, spaces and a final X (with an optional urn:isbn:) look like an ISBN.
  if (!/^(urn:isbn:)?[\d\s-]+[\dXx]?$/i.test(raw)) return { kind: 'not-isbn' };
  const isbn = cleanIsbn(raw);
  if (isbn.length === 13 && /^\d{13}$/.test(isbn)) {
    if (isValidIsbn13(isbn)) return { kind: 'isbn13', isbn };
    const expected = isbn13CheckDigit(isbn);
    return { kind: 'bad-check', length: 13, expected, corrected: isbn.slice(0, 12) + expected };
  }
  if (isbn.length === 10 && /^\d{9}[\dX]$/.test(isbn)) {
    if (isValidIsbn10(isbn)) return { kind: 'isbn10', isbn, as13: isbn10to13(isbn) };
    const expected = isbn10CheckDigit(isbn);
    return { kind: 'bad-check', length: 10, expected, corrected: isbn.slice(0, 9) + expected };
  }
  return { kind: 'not-isbn' };
}
