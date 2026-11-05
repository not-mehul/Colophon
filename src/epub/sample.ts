// The sample edition: an EPUB 2 with things to mend. Its chapter files are
// named out of order, one file is not in the manifest, the cover is small and
// tagged for EPUB 2 only, the synopsis and publisher are missing, one image
// has no alt text and one chapter does not declare its language.

import { bytes, type Files, writeEpub } from './archive';

const chapter = (title: string, body: string, lang = true) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"${lang ? ' xml:lang="en" lang="en"' : ''}>
<head><title>${title}</title><link rel="stylesheet" type="text/css" href="../styles/main.css"/></head>
<body>
  <h1>${title}</h1>
${body}
</body>
</html>
`;

export function sampleEpub(coverJpeg: Uint8Array): Uint8Array {
  const files: Files = new Map();
  files.set(
    'META-INF/container.xml',
    bytes(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`),
  );
  files.set('OEBPS/images/cover.jpg', coverJpeg);
  files.set('OEBPS/images/ornament.jpg', coverJpeg);
  files.set(
    'OEBPS/styles/main.css',
    bytes(`body { font-family: Georgia, serif; line-height: 1.65; margin: 2em; }
h1, h2 { font-weight: normal; font-style: italic; }
p { text-indent: 1.25em; margin: 0.5em 0; }
`),
  );
  files.set(
    'OEBPS/text/zz_opening_leaf.xhtml',
    bytes(
      chapter(
        'I. Foundations of Digital Bookmaking',
        `  <p>Digital publications combine portable typography with structured metadata inside an open archive format. When properly packaged, an electronic edition adapts gracefully across screen sizes, pixel densities, and assistive reading technologies.</p>
  <p>Inside every archive lies a container descriptor, a package document, and a sequence of content documents organized along a reading spine.</p>`,
      ),
    ),
  );
  files.set(
    'OEBPS/text/draft_folio_b.xhtml',
    bytes(
      chapter(
        'II. Proportion and Responsive Measure',
        `  <p>Flexible spacing, relative font sizing, and clean semantic markup ensure that readers can customize margins, line heights, and typefaces without breaking page layout rules.</p>
  <p><img src="../images/ornament.jpg"/></p>
  <p>Well-crafted stylesheets avoid rigid pixel dimensions and embrace fluid containers that respect user preferences on both tablet displays and electronic ink screens.</p>`,
      ),
    ),
  );
  files.set(
    'OEBPS/text/09_colophon_notes.xhtml',
    bytes(
      chapter(
        "III. The Printer's Colophon and Imprint",
        `  <p>Accurate bibliographic records allow personal libraries and catalog systems to index titles by author, series, publication date, and subject classification.</p>
  <p>Including high-resolution cover artwork alongside both modern and legacy manifest declarations guarantees visual consistency across every generation of reading device.</p>`,
        false,
      ),
    ),
  );
  files.set('OEBPS/extras/printer_scratch_note.txt', bytes('Unmanifested proofreader note left in archive.'));
  files.set(
    'OEBPS/toc.ncx',
    bytes(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:colophon-specimen-2026"/></head>
  <docTitle><text>The Art of Digital Bookmaking</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>I. Foundations of Digital Bookmaking</text></navLabel>
      <content src="text/zz_opening_leaf.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel><text>II. Proportion and Responsive Measure</text></navLabel>
      <content src="text/draft_folio_b.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-3" playOrder="3">
      <navLabel><text>III. The Printer's Colophon and Imprint</text></navLabel>
      <content src="text/09_colophon_notes.xhtml"/>
    </navPoint>
  </navMap>
</ncx>
`),
  );
  files.set(
    'OEBPS/content.opf',
    bytes(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">urn:uuid:colophon-specimen-2026</dc:identifier>
    <dc:title>The Art of Digital Bookmaking</dc:title>
    <dc:creator>Clara Vance</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>2024</dc:date>
    <dc:subject>Typography</dc:subject>
    <dc:subject>Book Design</dc:subject>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="styles/main.css" media-type="text/css"/>
    <item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>
    <item id="ornament" href="images/ornament.jpg" media-type="image/jpeg"/>
    <item id="ch1" href="text/zz_opening_leaf.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="text/draft_folio_b.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="text/09_colophon_notes.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>
`),
  );
  return writeEpub(files);
}
