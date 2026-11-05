// EPUBs opened from elsewhere: "Open with Colophon" on Android (a VIEW intent
// for application/epub+zip) and the document type on iOS. Both arrive as
// appUrlOpen with a content:// or file:// URL that the Filesystem plugin can read.
// colophon:// links from the sibling apps (style.md §14.1) arrive the same way.

import { App } from '@capacitor/app';
import { Filesystem } from '@capacitor/filesystem';
import { base64ToBytes } from '../lib/base64';
import { parseLink, type AppLink } from './links';
import { isNative } from './native';

export interface Incoming {
  name: string;
  bytes: Uint8Array;
}

function nameFrom(url: string): string {
  const last = decodeURIComponent(url.split(/[?#]/)[0]!.split('/').pop() ?? '');
  // Android content URIs often end in an opaque id rather than a file name.
  return /\.epub$/i.test(last) ? last : 'opened.epub';
}

async function read(url: string): Promise<Incoming | null> {
  if (!/^(content|file):/i.test(url)) return null;
  const { data } = await Filesystem.readFile({ path: url });
  const bytes = typeof data === 'string' ? base64ToBytes(data) : new Uint8Array(await data.arrayBuffer());
  return { name: nameFrom(url), bytes };
}

/** Calls `onOpen` for the file the app was launched with, and for each one after; `onLink` for colophon:// links. */
export async function listenForFiles(
  onOpen: (file: Incoming) => void,
  onError: (err: unknown) => void,
  onLink: (link: AppLink) => void = () => undefined,
): Promise<void> {
  if (!isNative) return;
  const handle = (url: string | undefined) => {
    if (!url) return;
    const link = parseLink(url, 'colophon');
    if (link) {
      onLink(link);
      return;
    }
    read(url)
      .then((file) => file && onOpen(file))
      .catch(onError);
  };
  await App.addListener('appUrlOpen', (event) => handle(event.url));
  const launch = await App.getLaunchUrl().catch(() => undefined);
  handle(launch?.url);
}
