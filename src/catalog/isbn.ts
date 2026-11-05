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
