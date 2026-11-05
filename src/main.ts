// Colophon: loads settings and the library bench, applies the theme, mounts
// the Svelte UI, and wires the native shell (back button, splash, open-with).

import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { mount } from 'svelte';
import App from './App.svelte';
import { listenForFiles } from './platform/intake';
import { isNative } from './platform/native';
import { applyTheme } from './platform/theme.svelte';
import { bench } from './state/bench.svelte';
import { library } from './state/library.svelte';
import { settings } from './state/settings.svelte';
import { ui } from './state/ui.svelte';
import './styles/app.css';

async function start(): Promise<void> {
  await Promise.all([settings.load(), library.load()]).catch((err) => console.error('Loading saved data failed:', err));
  applyTheme(settings.value.theme);

  mount(App, { target: document.getElementById('app')! });

  // Back to the edition that was on the bench, with its unsaved edits.
  const last = settings.value.lastEditionId;
  if (last && library.get(last)) await bench.openStored(last);

  ui.onLeaveEdition = () => {
    if (!bench.edition) return false;
    bench.close();
    return true;
  };

  if (isNative) {
    // Android back: overlays, then Inspection, then the library, then exit.
    void CapacitorApp.addListener('backButton', () => {
      if (!ui.back()) void CapacitorApp.exitApp();
    });
    void CapacitorApp.addListener('pause', () => bench.flush());
    void listenForFiles(
      (file) => void bench.openBytes(file.bytes, file.name),
      (err) => ui.notify(`Couldn't open that file (${err instanceof Error ? err.message : String(err)}).`, 'error'),
    );
    await SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);
  }
  addEventListener('pagehide', () => bench.flush());
}

void start();
