// A small Markdown reader for the new-edition builder: headings, paragraphs,
// emphasis, links, lists, block quotes, rules and code. It writes XHTML that
// is always well formed, and splits a manuscript into chapters at its headings.

import { escapeXml } from './xml';

function inline(source: string): string {
  let out = escapeXml(source);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a: string | undefined, b: string | undefined) => `<strong>${a ?? b}</strong>`);
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*)\*|(^|[^_\w])_([^_\s][^_]*)_/g, (_, p1: string | undefined, a: string | undefined, p2: string | undefined, b: string | undefined) =>
    a !== undefined ? `${p1}<em>${a}</em>` : `${p2}<em>${b}</em>`,
  );
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => `<a href="${href.replace(/"/g, '&quot;')}">${label}</a>`);
  return out;
}

/** Markdown to an XHTML body fragment. */
export function markdownToXhtml(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (code) {
      if (/^```/.test(line)) {
        out.push(`<pre><code>${escapeXml(code.join('\n'))}</code></pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (/^```/.test(line)) {
      flushAll();
      code = [];
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flushAll();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushAll();
      out.push('<hr/>');
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
      continue;
    }
    const quoted = line.match(/^\s*>\s?(.*)$/);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]!);
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  if (code) out.push(`<pre><code>${escapeXml(code.join('\n'))}</code></pre>`);
  flushAll();
  return out.join('\n');
}

export interface ManuscriptChapter {
  title: string;
  /** Markdown, including the chapter's own heading. */
  body: string;
}

/**
 * Splits a manuscript at its top-level headings ("# " or, if there are none,
 * "## "). Text before the first heading becomes an untitled opening chapter.
 */
export function splitManuscript(source: string): ManuscriptChapter[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const level = lines.some((l) => /^#\s+/.test(l)) ? '#' : lines.some((l) => /^##\s+/.test(l)) ? '##' : null;
  if (!level) return source.trim() ? [{ title: 'Chapter 1', body: source.trim() }] : [];
  const re = new RegExp(`^${level}\\s+(.*?)\\s*#*\\s*$`);
  const chapters: ManuscriptChapter[] = [];
  let current: ManuscriptChapter | null = null;
  const opening: string[] = [];
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      if (current) chapters.push(current);
      current = { title: m[1]!.replace(/[*_`]/g, ''), body: `${line}\n` };
    } else if (current) current.body += `${line}\n`;
    else opening.push(line);
  }
  if (current) chapters.push(current);
  if (opening.join('').trim()) chapters.unshift({ title: 'Opening', body: opening.join('\n').trim() });
  return chapters.map((c) => ({ ...c, body: c.body.trim() }));
}

/** Plain text to paragraphs, for .txt chapters. */
export function textToXhtml(source: string, title: string): string {
  const paragraphs = source
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [`<h1>${escapeXml(title)}</h1>`, ...paragraphs.map((p) => `<p>${escapeXml(p)}</p>`)].join('\n');
}
