// The theme on screen: System, Dusk (dark) or Dawn (light). Paints data-theme
// and the theme-color meta (style.md §2).

import type { ThemeSetting } from '../state/settings';

/** Read by the inline script in index.html, so the first paint has the right theme. */
const STORAGE_KEY = 'colophon.theme';

const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
let current: ThemeSetting = 'system';

/** The theme on screen now, after "system" is resolved. */
export const shown = $state({ dark: true });

function resolved(setting: ThemeSetting): 'light' | 'dark' {
  if (setting !== 'system') return setting;
  return media?.matches === false ? 'light' : 'dark';
}

function paint(): void {
  const theme = resolved(current);
  document.documentElement.dataset.theme = theme;
  shown.dark = theme === 'dark';
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--bg-grad-mid').trim();
  if (surface) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
  dispatchEvent(new Event('themechange'));
}

media?.addEventListener('change', () => {
  if (current === 'system') paint();
});

export function applyTheme(setting: ThemeSetting): void {
  current = setting;
  try {
    localStorage.setItem(STORAGE_KEY, setting);
  } catch {
    // Private mode: the first paint falls back to the system theme.
  }
  paint();
}

/** The header switch: picks the side opposite to the one on screen. */
export function toggledTheme(): ThemeSetting {
  return shown.dark ? 'light' : 'dark';
}
