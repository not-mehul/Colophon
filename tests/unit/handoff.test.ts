import { describe, expect, it } from 'vitest';
import { bookShelfUrl, isbnOf } from '../../src/platform/handoff';
import { parseLink } from '../../src/platform/links';

describe('hand-off to BookShelf', () => {
  it('sends the title, author and ISBN as a bookshelf:// log link', () => {
    const url = bookShelfUrl({ title: 'The Dispossessed', creator: 'Ursula K. Le Guin', isbn: 'urn:isbn:978-0-06-051275-4' });
    expect(parseLink(url)).toEqual({
      app: 'bookshelf',
      action: 'log',
      params: { title: 'The Dispossessed', author: 'Ursula K. Le Guin', isbn: '9780060512754' },
      source: 'colophon',
    });
  });

  it('leaves out identifiers that are not ISBNs', () => {
    expect(isbnOf('urn:uuid:1b4e28ba-2fa1-11d2-883f-0016d3cca427')).toBe('');
    expect(isbnOf('0-441-17271-x')).toBe('044117271X');
    expect(parseLink(bookShelfUrl({ title: 'Dune' }))!.params).toEqual({ title: 'Dune' });
  });
});
