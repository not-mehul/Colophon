// Writing files the reader keeps or sends: a download, or the browser's
// share sheet where it has one.

export interface OutputFile {
  name: string;
  data: Uint8Array;
  mime: string;
}

function download(file: OutputFile): void {
  const blob = new Blob([file.data as BlobPart], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Saves a file as a download; the result is where it went. */
export async function saveFile(file: OutputFile): Promise<{ path: string; label: string; uri: string | null }> {
  download(file);
  return { path: file.name, label: `Downloads/${file.name}`, uri: null };
}

/** Opens the share sheet for a file (a bound EPUB, a report card), or downloads it where there is none. */
export async function shareFile(file: OutputFile, title: string): Promise<void> {
  const shared = new File([file.data as BlobPart], file.name, { type: file.mime });
  if (navigator.canShare?.({ files: [shared] })) {
    try {
      await navigator.share({ title, files: [shared] });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
    }
  }
  download(file);
}
