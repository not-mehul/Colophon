// EPUB fixtures, built in code so each test states exactly what is in them:
// the sample EPUB 2 (with its deliberate flaws), a clean EPUB 3 from the
// builder, and a broken EPUB that fails most of validation.

import { strToU8, zipSync } from 'fflate';
import { buildEpub } from '../../src/epub/build';
import { sampleEpub } from '../../src/epub/sample';
import { EMPTY_META } from '../../src/epub/types';

/** The header of a JPEG of the given size: enough for imageSize(), not for a decoder. */
export function fakeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

export const epub2 = () => sampleEpub(fakeJpeg(300, 450));

export const epub3 = () =>
  buildEpub({
    meta: {
      ...EMPTY_META,
      title: 'A Field Guide to Margins',
      creator: 'Iris Holt, Tomas Reyes',
      identifier: '9780141439518',
      publisher: 'Meridian Press',
      date: '2025-03-01',
      subjects: ['Typography'],
      description: 'An essay on the white space around text, and why readers notice it when it is wrong.',
    },
    chapters: [
      { title: 'Gutters', body: '<h1>Gutters</h1>\n<p>The inner margin of a spread.</p>' },
      { title: 'Heads and feet', body: '<h1>Heads and feet</h1>\n<p>Above and below the text block.</p>' },
    ],
    cover: { bytes: fakeJpeg(1600, 2400), mediaType: 'image/jpeg' },
    now: new Date('2026-01-01T00:00:00Z'),
    uuid: '00000000-0000-4000-8000-000000000000',
  });

/**
 * Broken on purpose: no mimetype entry, no container, a chapter that is not
 * well-formed, a manifest item whose file is missing, a link and an image that
 * go nowhere, a stylesheet whose font is missing, and a spine entry with no item.
 */
export function brokenEpub(): Uint8Array {
  const file = (s: string) => strToU8(s);
  return zipSync({
    'content.opf': file(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Broken</dc:title><dc:language>en</dc:language></metadata>
  <manifest>
    <item id="a" href="a.xhtml" media-type="application/xhtml+xml"/>
    <item id="b" href="b.xhtml" media-type="application/xhtml+xml"/>
    <item id="gone" href="gone.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style/book.css" media-type="text/css"/>
    <item id="font" href="fonts/Body.woff2" media-type="font/woff2"/>
  </manifest>
  <spine><itemref idref="a"/><itemref idref="b"/><itemref idref="ghost"/></spine>
</package>`),
    'a.xhtml': file(`<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A</title></head>
<body><h1>A</h1><p>Unclosed paragraph<br><p epub:type="note">Second</body></html>`),
    'b.xhtml': file(`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>B</title>
<link rel="stylesheet" href="style/book.css"/><link rel="stylesheet" href="style/missing.css"/></head>
<body><h1>B</h1><p><a href="nowhere.xhtml#x">a link</a> and <a href="old/a.xhtml">a moved one</a></p><p><img src="pic.png" alt="A picture"/></p></body></html>`),
    'style/book.css': file(`@font-face { font-family: Body; src: url("../fonts/Body.woff2"); }
@font-face { font-family: Gone; src: url(../fonts/Gone.ttf); }
body { font-family: Body; }`),
    'fonts/Body.woff2': new Uint8Array([0, 1, 0, 0]),
  });
}
