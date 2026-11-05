// Small formatting helpers for the UI.

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function relativeDay(when: number, now = Date.now()): string {
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(when).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(when).toLocaleDateString('en', { day: 'numeric', month: 'short', year: new Date(when).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}

/** An object URL for bytes, for <img>; the caller revokes it. */
export function blobUrl(bytes: Uint8Array | null | undefined, type = 'image/jpeg'): string | null {
  return bytes?.length ? URL.createObjectURL(new Blob([bytes as BlobPart], { type })) : null;
}

/** Words a reader gets through in a minute of steady reading, for the estimate. */
export const READING_WPM = 238;

export function readingMinutes(words: number): number {
  return words > 0 ? Math.max(1, Math.round(words / READING_WPM)) : 0;
}

/** "4 min", "2 h 15 min", "11 h". */
export function readingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
