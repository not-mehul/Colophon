// Colophon's moments of delight and its easter eggs (style.md §11.3). The
// animations come from dusk-dawn and all of them respect reduced motion; the
// toast always says what happened, so nothing is only visual.

import { celebrate, createEggs, type CelebrateOptions } from 'dusk-dawn/expressive';
import { ui } from '../state/ui.svelte';

export const EGGS = ['konami', 'title', 'lorem'] as const;
export type Egg = (typeof EGGS)[number];

const eggs = createEggs('colophon', EGGS);

/** A printer's sorts: fleurons, pilcrows, asterisms and the odd ampersand. */
export const SORTS: CelebrateOptions = {
  glyphs: ['❦', '❧', '☙', '⁂', '¶', '&', '§'],
  shapes: ['diamond', 'circle', 'clover-4', 'gem'],
  colours: ['--accent-bright', '--accent-amber', '--accent-sage', '--text-heading'],
};

/** An easter egg hatches: its toast, with the count the first time it's found. */
export function hatch(id: Egg, message: string): void {
  const { isNew, found, total } = eggs.find(id);
  ui.notify(isNew ? `${message} Easter egg found: ${found} of ${total}.` : message, 'celebrate');
}

export function eggsFound(): number {
  return eggs.found().length;
}

/** A real accomplishment: a shower of sorts, from where it happened. */
export function cheer(origin?: Element | null, options: CelebrateOptions = {}): void {
  void celebrate({ ...SORTS, origin: origin ?? undefined, ...options });
}
