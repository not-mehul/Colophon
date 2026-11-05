// Building a new EPUB 3 from chapters: a package document with a nav and an
// NCX, one XHTML file per chapter, a stylesheet and an optional cover.

import { bytes, type Files, writeEpub } from './archive';
import { CONFORMS_TO } from './accessibility';
import { slugify } from './filename';
import { newNav, newNcx } from './toc';
import type { Meta } from './types';
import { escapeXml } from './xml';

export interface BuildChapter {
  title: string;
  /** An XHTML body fragment. */
  body: string;
}

export interface BuildInput {
  meta: Meta;
  chapters: BuildChapter[];
  cover?: { bytes: Uint8Array; mediaType: string } | null;
  now?: Date;
  /** For tests; otherwise a random UUID. */
  uuid?: string;
}

export const BUILD_CSS = `body { font-family: serif; line-height: 1.6; margin: 0 5%; }
h1, h2, h3 { font-weight: normal; line-height: 1.25; margin: 1.5em 0 0.75em; }
h1 { font-size: 1.6em; font-style: italic; }
p { margin: 0; text-indent: 1.25em; }
h1 + p, h2 + p, h3 + p, hr + p, blockquote + p { text-indent: 0; }
blockquote { margin: 1em 1.5em; font-style: italic; }
hr { border: 0; text-align: center; margin: 1.5em 0; }
hr::after { content: "* * *"; }
pre { white-space: pre-wrap; font-size: 0.9em; }
img { max-width: 100%; }
`;

function chapterXhtml(chapter: BuildChapter, lang: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(lang)}" xml:lang="${escapeXml(lang)}">
<head>
<meta charset="UTF-8"/>
<title>${escapeXml(chapter.title)}</title>
<link rel="stylesheet" type="text/css" href="../styles/book.css"/>
</head>
<body>
<section epub:type="chapter" role="doc-chapter">
${chapter.body}
</section>
</body>
</html>
`;
}

function coverXhtml(title: string, lang: string, ext: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(lang)}" xml:lang="${escapeXml(lang)}">
<head><meta charset="UTF-8"/><title>Cover</title>
<style>body { margin: 0; text-align: center; } img { max-width: 100%; max-height: 100vh; }</style></head>
<body epub:type="cover"><img src="../images/cover.${ext}" alt="Cover of ${escapeXml(title)}"/></body>
</html>
`;
}

export function buildEpub({ meta, chapters, cover, now = new Date(), uuid }: BuildInput): Uint8Array {
  const lang = meta.language || 'en';
  const title = meta.title.trim() || 'Untitled';
  const id = meta.identifier.trim() || `urn:uuid:${uuid ?? crypto.randomUUID()}`;
  const files: Files = new Map();

  files.set(
    'META-INF/container.xml',
    bytes(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`),
  );
  files.set('OEBPS/styles/book.css', bytes(BUILD_CSS));

  const used = new Set<string>();
  const docs = chapters.map((chapter, i) => {
    let name = `${String(i + 1).padStart(3, '0')}_${slugify(chapter.title)}.xhtml`;
    if (used.has(name)) name = name.replace('.xhtml', `_${i + 1}.xhtml`);
    used.add(name);
    const path = `OEBPS/text/${name}`;
    files.set(path, bytes(chapterXhtml(chapter, lang)));
    return { id: `ch${i + 1}`, href: `text/${name}`, path, title: chapter.title };
  });

  const entries = docs.map((d) => ({ label: d.title, target: d.path, depth: 0 }));
  files.set('OEBPS/nav.xhtml', bytes(newNav('OEBPS/nav.xhtml', entries, title, lang)));
  files.set('OEBPS/toc.ncx', bytes(newNcx('OEBPS/toc.ncx', entries, title, id)));

  let coverItems = '';
  let coverSpine = '';
  if (cover) {
    const ext = cover.mediaType === 'image/png' ? 'png' : cover.mediaType === 'image/webp' ? 'webp' : 'jpg';
    files.set(`OEBPS/images/cover.${ext}`, cover.bytes);
    files.set('OEBPS/text/cover.xhtml', bytes(coverXhtml(title, lang, ext)));
    coverItems = `
    <item id="cover-image" href="images/cover.${ext}" media-type="${cover.mediaType}" properties="cover-image"/>
    <item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>`;
    coverSpine = '\n    <itemref idref="cover" linear="no"/>';
  }

  const dc = (name: string, value: string, attrs = '') =>
    value.trim() ? `\n    <dc:${name}${attrs}>${escapeXml(value.trim())}</dc:${name}>` : '';
  const creators = meta.creator
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => dc('creator', c))
    .join('');
  const series = meta.series.trim()
    ? `
    <meta property="belongs-to-collection" id="colophon-series">${escapeXml(meta.series.trim())}</meta>${
      meta.seriesIndex.trim() ? `\n    <meta refines="#colophon-series" property="group-position">${escapeXml(meta.seriesIndex.trim())}</meta>` : ''
    }
    <meta name="calibre:series" content="${escapeXml(meta.series.trim())}"/>${
      meta.seriesIndex.trim() ? `\n    <meta name="calibre:series_index" content="${escapeXml(meta.seriesIndex.trim())}"/>` : ''
    }`
    : '';

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="${escapeXml(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${dc('identifier', id, ' id="BookId"')}${dc('title', title)}${creators}${dc('language', lang)}${dc('publisher', meta.publisher)}${dc('date', meta.date)}${dc('description', meta.description)}${meta.subjects.map((s) => dc('subject', s)).join('')}
    <meta property="dcterms:modified">${now.toISOString().slice(0, 19)}Z</meta>${series}${cover ? '\n    <meta name="cover" content="cover-image"/>' : ''}
    <meta property="schema:accessMode">textual</meta>
    <meta property="schema:accessModeSufficient">textual</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
    <meta property="schema:accessibilityFeature">readingOrder</meta>
    <meta property="schema:accessibilityFeature">displayTransformability</meta>
    <meta property="schema:accessibilityHazard">none</meta>
    <meta property="schema:accessibilitySummary">This publication is reflowable text with a navigable table of contents.</meta>
    <meta property="dcterms:conformsTo">${CONFORMS_TO}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles/book.css" media-type="text/css"/>${coverItems}
${docs.map((d) => `    <item id="${d.id}" href="${escapeXml(d.href)}" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine toc="ncx">${coverSpine}
${docs.map((d) => `    <itemref idref="${d.id}"/>`).join('\n')}
  </spine>
</package>
`;
  files.set('OEBPS/content.opf', bytes(opf));
  return writeEpub(files);
}
