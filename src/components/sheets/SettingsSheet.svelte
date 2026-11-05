<script lang="ts">
  // Settings, saved as they change. API keys go to secure storage.
  import { db } from '../../state/db';
  import { library } from '../../state/library.svelte';
  import { settings } from '../../state/settings.svelte';
  import type { SecretKey, Settings } from '../../state/settings';
  import { ui } from '../../state/ui.svelte';
  import { SHORTCUTS } from '../../lib/keys';
  import { isNative } from '../../platform/native';
  import Sheet from '../ui/Sheet.svelte';
  import Switch from '../ui/Switch.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const v = $derived(settings.value);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const set = (patch: Partial<Settings>) => void settings.update(patch);

  const KEYS: { key: SecretKey; label: string; hint: string }[] = [
    { key: 'googleApiKey', label: 'Google Books key', hint: 'Optional. Raises the daily search limit.' },
    { key: 'isbndbApiKey', label: 'ISBNdb key', hint: 'Adds ISBNdb to searches.' },
    { key: 'customCatalogKey', label: 'Custom catalog key', hint: 'Sent as a Bearer token.' },
  ];

  async function clearCache() {
    await db.catalog.clear();
    ui.notify('Saved catalog results cleared.', 'success');
  }

  async function clearLibrary() {
    const ok = await ui.confirm({
      title: 'Clear the bench?',
      message: `Removes ${library.items.length} editions and their unsaved edits from Colophon. Files you've bound and saved stay where they are.`,
      action: 'Clear the bench',
      danger: true,
    });
    if (!ok) return;
    await library.remove(library.items.map((e) => e.id));
    ui.notify('The bench is clear.', 'success');
  }
</script>

<Sheet title="Settings" {onclose}>
  <section class="settings-group">
    <h3 class="t-section-label">Appearance</h3>
    <div class="segmented" role="radiogroup" aria-label="Theme">
      {#each [['system', 'System'], ['dark', 'Dusk'], ['light', 'Dawn']] as const as [id, label] (id)}
        <button type="button" role="radio" aria-checked={v.theme === id} onclick={() => set({ theme: id })}>{label}</button>
      {/each}
    </div>
  </section>

  <section class="settings-group">
    <h3 class="t-section-label">Catalogs</h3>
    {#each KEYS as k (k.key)}
      <label class="field">
        <span class="t-field-label">{k.label}</span>
        <input class="input input-mono" type="password" autocomplete="off" spellcheck="false" value={settings.secrets[k.key]} onchange={(e) => void settings.setSecret(k.key, e.currentTarget.value)} />
        <span class="field-hint">{k.hint}{isNative ? ' Kept in the device keystore.' : ''}</span>
      </label>
    {/each}
    <label class="field">
      <span class="t-field-label">Custom catalog URL</span>
      <input class="input input-mono" type="url" placeholder="https://example.org/search?q={'{query}'}" value={v.customCatalogUrl} onchange={(e) => set({ customCatalogUrl: e.currentTarget.value.trim() })} />
    </label>
    {#if !isNative}
      <label class="field">
        <span class="t-field-label">CORS proxy for covers</span>
        <input class="input input-mono" type="url" placeholder="https://proxy.example/?url=" value={v.corsProxyUrl} onchange={(e) => set({ corsProxyUrl: e.currentTarget.value.trim() })} />
        <span class="field-hint">Only the browser needs this. The apps download covers directly.</span>
      </label>
    {/if}
    <div class="field">
      <span class="t-field-label">Results per catalog</span>
      <div class="segmented" role="radiogroup" aria-label="Results per catalog">
        {#each [6, 8, 12] as const as n (n)}<button type="button" role="radio" aria-checked={v.maxCatalogResults === n} onclick={() => set({ maxCatalogResults: n })}>{n}</button>{/each}
      </div>
    </div>
  </section>

  <section class="settings-group">
    <h3 class="t-section-label">Inspection and binding</h3>
    <div class="field">
      <span class="t-field-label">Full marks for a cover from</span>
      <div class="segmented" role="radiogroup" aria-label="Cover width">
        {#each [800, 1000, 1200] as const as w (w)}<button type="button" role="radio" aria-checked={v.minCoverWidth === w} onclick={() => set({ minCoverWidth: w })}>{w} px</button>{/each}
      </div>
    </div>
    <div class="field">
      <span class="t-field-label">Compression</span>
      <div class="segmented" role="radiogroup" aria-label="Compression">
        {#each [[3, 'Fast'], [6, 'Balanced'], [9, 'Smallest']] as const as [level, label] (level)}<button type="button" role="radio" aria-checked={v.compression === level} onclick={() => set({ compression: level })}>{label}</button>{/each}
      </div>
    </div>
    <Switch checked={v.dualCoverTags} label="Write both cover tags" hint="The EPUB 2 meta and the EPUB 3 property, for every reader." onchange={(on) => set({ dualCoverTags: on })} />
    <Switch checked={v.purgeOrphans} label="Leave out orphan files" hint="Files the manifest doesn't list are dropped when binding." onchange={(on) => set({ purgeOrphans: on })} />
  </section>

  <section class="settings-group">
    <h3 class="t-section-label">Your data</h3>
    <p class="t-body-small dim">Editions stay on this device. Nothing is uploaded; catalogs see only what you search for.</p>
    <div class="btn-row btn-row-start">
      <button type="button" class="btn btn-secondary" onclick={() => void clearCache()}>Clear saved searches</button>
      <button type="button" class="btn btn-danger" disabled={!library.items.length} onclick={() => void clearLibrary()}>Clear the bench</button>
    </div>
  </section>

  <section class="settings-group">
    <h3 class="t-section-label">About</h3>
    <p class="t-body-small dim">Colophon {__APP_VERSION__}. An edition inspector, imprint editor and bindery for EPUB files.</p>
    {#if !isNative}
      <span class="t-field-label">Keyboard</span>
      <dl class="keys">
        {#each SHORTCUTS as s (s.keys)}<dt>{mac ? s.keys.replace('Ctrl', '⌘') : s.keys}</dt><dd>{s.does}</dd>{/each}
      </dl>
    {/if}
  </section>
</Sheet>
