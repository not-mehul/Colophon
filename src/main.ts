// Colophon: loads settings and the library bench, applies the theme and
// mounts the Svelte UI. It runs as one HTML file in the browser.

import { dismissOverlay } from 'dusk-dawn';
import { mount } from 'svelte';
import App from './App.svelte';
import favicon from './assets/favicon.svg?url';
import { applyTheme } from './platform/theme.svelte';
import { bench } from './state/bench.svelte';
import { library } from './state/library.svelte';
import { settings } from './state/settings.svelte';
import { ui } from './state/ui.svelte';
import './styles/app.css';

async function start(): Promise<void> {
  // Inlined by the single-file build, so the tab has an icon from a file:// page too.
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', favicon);

  await Promise.all([settings.load(), library.load()]).catch((err) => console.error('Loading saved data failed:', err));
  applyTheme(settings.value.theme);

  mount(App, { target: document.getElementById('app')! });

  // Back to the edition that was on the bench, with its unsaved edits.
  const last = settings.value.lastEditionId;
  if (last && library.get(last)) await bench.openStored(last);

  // Escape closes the topmost thing first: a menu, then a sheet or a modal
  // (style.md §14). A dialog that already handled it has cancelled the event.
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (dismissOverlay() || ui.closeTop()) e.preventDefault();
  });

  addEventListener('pagehide', () => bench.flush());
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') bench.flush();
  });
}

void start();
