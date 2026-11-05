// A chapter as a standalone page for the preview sheet: images become data
// URLs, stylesheets are inlined, scripts are dropped. Shown in a sandboxed
// iframe with no script permission, so the book's markup can't reach the app.

import { text } from './archive';
import { fileText } from './draft';
import { dirname, isExternal, resolvePath, splitFragment } from './paths';
import type { Draft, Edition } from './types';
import { bytesToBase64 } from '../lib/base64';
import { imageMime } from './image-size';

export interface PreviewColours {
  text: string;
  background: string;
  accent: string;
  serif: string;
}

export function chapterPage(edition: Edition, draft: Draft, path: string, colours: PreviewColours): string {
  const source = fileText(edition, draft, path, text);
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const dir = dirname(path);
  const dataUrl = (href: string): string | null => {
    if (!href || isExternal(href) || href.startsWith('data:')) return null;
    const file = edition.files.get(resolvePath(dir, splitFragment(href)[0]));
    return file ? `data:${imageMime(file)};base64,${bytesToBase64(file)}` : null;
  };
  doc.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
  });
  doc.querySelectorAll('img').forEach((img) => {
    const url = dataUrl(img.getAttribute('src') ?? '');
    if (url) img.setAttribute('src', url);
  });
  doc.querySelectorAll('image').forEach((img) => {
    const href = img.getAttribute('xlink:href') ?? img.getAttribute('href') ?? '';
    const url = dataUrl(href);
    if (url) {
      img.setAttribute('href', url);
      img.removeAttribute('xlink:href');
    }
  });
  doc.querySelectorAll('link[rel~="stylesheet"]').forEach((link) => {
    const cssPath = resolvePath(dir, link.getAttribute('href') ?? '');
    const css = fileText(edition, draft, cssPath, text).replace(/@import[^;]+;/g, '').replace(/url\([^)]*\)/g, 'none');
    const style = doc.createElement('style');
    style.textContent = css;
    link.replaceWith(style);
  });
  const base = doc.createElement('style');
  base.textContent = `html { color-scheme: light dark; }
body { color: ${colours.text}; background: ${colours.background}; font-family: ${colours.serif}; line-height: 1.6; margin: 1.25rem; font-size: 17px; overflow-wrap: break-word; }
img, svg { max-width: 100%; height: auto; }
a { color: ${colours.accent}; }`;
  doc.head.prepend(base);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}
