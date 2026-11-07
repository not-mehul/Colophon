// Keyboard shortcuts. Modifier shortcuts (bind, open, undo) work anywhere but
// leave a text field's own undo alone; single keys (tabs, the proof) only
// work when the focus is not in a field, so typing never triggers them.

import type { Tab } from '../state/ui.svelte';

export type Shortcut = 'bind' | 'open' | 'undo' | 'proof' | { tab: Tab };

export const TAB_KEYS: Record<string, Tab> = { '1': 'inspection', '2': 'imprint', '3': 'chapters', '4': 'catalog' };

/** What the person sees in Settings, in order. */
export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: 'Ctrl S', does: 'Bind the edition' },
  { keys: 'Ctrl O', does: 'Open an EPUB' },
  { keys: 'Ctrl Z', does: 'Undo the last change, while its toast shows' },
  { keys: '1 – 4', does: 'Inspection, Imprint, Chapters, Catalog' },
  { keys: 'P', does: 'The proof: every change before you bind' },
];

function editable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export function shortcut(e: KeyboardEvent, state: { overlay: boolean; edition: boolean }): Shortcut | null {
  if (e.defaultPrevented || e.isComposing) return null;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (mod && !e.altKey) {
    if (key === 's' && !e.shiftKey && state.edition && !state.overlay) return 'bind';
    if (key === 'o' && !e.shiftKey && !state.overlay) return 'open';
    if (key === 'z' && !e.shiftKey && !editable(e.target)) return 'undo';
    return null;
  }
  if (e.altKey || state.overlay || !state.edition || editable(e.target)) return null;
  if (TAB_KEYS[e.key]) return { tab: TAB_KEYS[e.key]! };
  if (key === 'p' && !e.shiftKey) return 'proof';
  return null;
}
