import { describe, expect, it } from 'vitest';
import { formatFileName, namedInOrder, numberChapters, slugify } from '../../src/epub/filename';
import { imageSize } from '../../src/epub/image-size';
import { EMPTY_META } from '../../src/epub/types';
import { fakeJpeg } from './fixtures';

const meta = { ...EMPTY_META, title: 'Dune: Messiah', creator: 'Frank Herbert', date: '1969-10-15', series: 'Dune', seriesIndex: '2' };

describe('file names', () => {
  it('fills a template and tidies empty fields', () => {
    expect(formatFileName('{Order} - {Author} - {Title} ({Year})', meta)).toBe('01 - Frank Herbert - Dune Messiah (1969).epub');
    expect(formatFileName('{Author} - {Series} #{SeriesIndex} - {Title}', meta)).toBe('Frank Herbert - Dune #2 - Dune Messiah.epub');
    expect(formatFileName('{Title} ({Year}) [{ISBN}]', { ...meta, date: '' })).toBe('Dune Messiah.epub');
    expect(formatFileName('', meta)).toBe('edition.epub');
  });

  it('slugs headings', () => {
    expect(slugify('Chapter Ünë: The Beginning of Everything Else')).toBe('chapter-une-the-beginning-of');
    expect(slugify('***')).toBe('section');
  });

  it('numbers chapter files without clashes', () => {
    const chapters = [
      { id: 'a', path: 'OEBPS/z.xhtml', fileName: 'z.xhtml', linear: true },
      { id: 'b', path: 'OEBPS/y.xhtml', fileName: 'y.xhtml', linear: true },
    ];
    const titles = new Map([['a', 'Same'], ['b', 'Same']]);
    expect(numberChapters(chapters, titles, { pattern: '{slug}', digits: 2 }).map((c) => c.fileName)).toEqual(['same.xhtml', 'same_2.xhtml']);
    expect(numberChapters(chapters, titles, { pattern: '{num}_{orig}', start: 0, digits: 2 }).map((c) => c.fileName)).toEqual(['00_z.xhtml', '01_y.xhtml']);
    expect(namedInOrder(chapters)).toBe(false);
    expect(namedInOrder(numberChapters(chapters, titles))).toBe(true);
  });

  it('measures images from their headers', () => {
    expect(imageSize(fakeJpeg(1600, 2400))).toEqual({ width: 1600, height: 2400 });
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 4, 0, 0, 0, 6, 0]);
    expect(imageSize(png)).toEqual({ width: 1024, height: 1536 });
    expect(imageSize(new Uint8Array(4))).toEqual({ width: 0, height: 0 });
  });
});
