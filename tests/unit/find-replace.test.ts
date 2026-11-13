import { describe, expect, it } from 'vitest';
import { readZip, text } from '../../src/epub/archive';
import { bind } from '../../src/epub/bind';
import { changeCount, newDraft } from '../../src/epub/draft';
import { describeChanges } from '../../src/epub/changes';
import { decodeEntities, findInChapters, replaceInChapters, replaceInXhtml } from '../../src/epub/find-replace';
import { oversizedImages, shrunkSize } from '../../src/epub/images';
import { openEpub } from '../../src/epub/open';
import { epub3, fakeJpeg } from './fixtures';

const page = (body: string) =>
  `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>margin</title><style>p.margin { color: red }</style></head><body>${body}</body></html>`;

describe('find and replace', () => {
  it('changes only the text, never tags, attributes, the head or styles', () => {
    const xhtml = page('<p class="margin">The margin <a href="margin.xhtml">margin</a></p><!-- margin -->');
    const { xhtml: out, count } = replaceInXhtml(xhtml, 'margin', 'edge');
    expect(count).toBe(2);
    expect(out).toContain('<p class="margin">The edge <a href="margin.xhtml">edge</a></p><!-- margin -->');
    expect(out).toContain('<title>margin</title>');
    expect(out).toContain('p.margin { color: red }');
  });

  it('reads entities as characters and escapes the replacement', () => {
    expect(decodeEntities('Fish &amp; Chips &#8212; &#x2019;')).toBe('Fish & Chips — ’');
    const { xhtml, count } = replaceInXhtml(page('<p>Fish &amp; Chips</p>'), 'Fish & Chips', 'Bread & <Butter>');
    expect(count).toBe(1);
    expect(xhtml).toContain('<p>Bread &amp; &lt;Butter&gt;</p>');
  });

  it('honours match case and whole words', () => {
    const xhtml = page('<p>Art, art and artful.</p>');
    expect(replaceInXhtml(xhtml, 'art', 'X').count).toBe(3);
    expect(replaceInXhtml(xhtml, 'art', 'X', { matchCase: true }).count).toBe(2);
    expect(replaceInXhtml(xhtml, 'art', 'X', { wholeWord: true }).count).toBe(2);
    expect(replaceInXhtml(xhtml, 'art', 'X', { wholeWord: true, matchCase: true }).xhtml).toContain('<p>Art, X and artful.</p>');
  });

  it('treats the query as plain text, not a pattern', () => {
    expect(replaceInXhtml(page('<p>a.b axb</p>'), 'a.b', 'ok').xhtml).toContain('<p>ok axb</p>');
  });

  it('finds across chapters with context, replaces into the draft, and binds it', () => {
    const edition = openEpub(epub3());
    const draft = newDraft(edition);
    const found = findInChapters(edition, draft, 'the');
    expect(found.map((c) => c.title)).toEqual(['Gutters', 'Heads and feet']);
    expect(found[0]!.samples[0]).toEqual({ before: '', match: 'The', after: ' inner margin of a spread.' });
    expect(replaceInChapters(edition, draft, 'margin', 'gutter', {})).toBe(1);
    expect(changeCount(edition, draft)).toBe(1);
    const files = readZip(bind(edition, draft)).files;
    const path = found[0]!.path;
    expect(text(files.get(path))).toContain('The inner gutter of a spread.');
    expect(findInChapters(edition, draft, 'margin')).toEqual([]);
  });
});

describe('oversized images', () => {
  function withPicture(width: number, height: number, size = 0) {
    const edition = openEpub(epub3());
    const dir = edition.opfDir;
    const bytes = new Uint8Array(Math.max(size, 64));
    bytes.set(fakeJpeg(width, height));
    edition.files.set(`${dir}images/plate.jpg`, bytes);
    edition.manifest.push({ id: 'plate', href: 'images/plate.jpg', path: `${dir}images/plate.jpg`, mediaType: 'image/jpeg', properties: [], exists: true });
    return edition;
  }

  it('lists pictures over 2000 px or 1 MB, but not the cover', () => {
    expect(oversizedImages(withPicture(1200, 800), newDraft(withPicture(1200, 800)))).toEqual([]);
    const big = withPicture(4000, 3000);
    const list = oversizedImages(big, newDraft(big));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ width: 4000, height: 3000, mediaType: 'image/jpeg' });
    const heavy = withPicture(1500, 1000, 2_000_000);
    expect(oversizedImages(heavy, newDraft(heavy))).toHaveLength(1);
  });

  it('draws them at 1600 px on the longest side', () => {
    expect(shrunkSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(shrunkSize(1000, 3000)).toEqual({ width: 533, height: 1600 });
    expect(shrunkSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('binds the smaller copy at the same path, and counts it as one change', () => {
    const edition = withPicture(4000, 3000);
    const draft = newDraft(edition);
    const path = `${edition.opfDir}images/plate.jpg`;
    const small = fakeJpeg(1600, 1200);
    draft.images = { [path]: small };
    expect(oversizedImages(edition, draft)).toEqual([]);
    expect(changeCount(edition, draft)).toBe(1);
    expect(describeChanges(edition, draft).map((c) => c.label)).toContain('1 image shrunk');
    expect(readZip(bind(edition, draft)).files.get(path)).toEqual(small);
  });
});
