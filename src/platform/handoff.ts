// Hand-off to the sibling apps through their URL schemes (style.md §14.1),
// the same on Android and iOS:
//
//   bookshelf://log?title=…&author=…&isbn=…&source=colophon
//     opens BookShelf on a search for the edition, ready to add.
//
// When BookShelf isn't installed (or this is the web build) the caller falls
// back to the share sheet with "Title by Author".

import { AppLauncher } from '@capacitor/app-launcher';
import { buildLink } from './links';
import { isNative } from './native';

export interface BookShelfBook {
  title: string;
  creator?: string;
  isbn?: string;
}

/** The identifier when it is an ISBN-10 or ISBN-13, digits only; '' otherwise. */
export function isbnOf(identifier: string | undefined): string {
  const digits = (identifier ?? '').replace(/^urn:isbn:/i, '').replace(/[^\dXx]/g, '');
  return /^(\d{9}[\dXx]|97[89]\d{10})$/.test(digits) ? digits.toUpperCase() : '';
}

export function bookShelfUrl(book: BookShelfBook): string {
  return buildLink('bookshelf', 'log', { title: book.title, author: book.creator, isbn: isbnOf(book.isbn) }, 'colophon');
}

/** Opens BookShelf with the book. False when BookShelf isn't there to take it. */
export async function sendToBookShelf(book: BookShelfBook): Promise<boolean> {
  if (!isNative || !book.title.trim()) return false;
  try {
    const { value } = await AppLauncher.canOpenUrl({ url: 'bookshelf://' });
    if (!value) return false;
    await AppLauncher.openUrl({ url: bookShelfUrl(book) });
    return true;
  } catch {
    return false;
  }
}
