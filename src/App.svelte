<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tierOf, tierText } from './epub/audit';
  import { plural } from './lib/format';
  import { applyTheme, shown, toggledTheme } from './platform/theme.svelte';
  import { EPUB_ACCEPT, fileBytes, pickFile } from './lib/pick';
  import { shortcut } from './lib/keys';
  import { bench } from './state/bench.svelte';
  import { library } from './state/library.svelte';
  import { settings } from './state/settings.svelte';
  import { ui, type Tab } from './state/ui.svelte';
  import CatalogView from './components/CatalogView.svelte';
  import ChaptersView from './components/ChaptersView.svelte';
  import ImprintView from './components/ImprintView.svelte';
  import InspectionView from './components/InspectionView.svelte';
  import IdleStick from './components/IdleStick.svelte';
  import LibraryView from './components/LibraryView.svelte';
  import IdleDock from './components/ui/IdleDock.svelte';
  import A11ySheet from './components/sheets/A11ySheet.svelte';
  import AltTextSheet from './components/sheets/AltTextSheet.svelte';
  import ChapterPreview from './components/sheets/ChapterPreview.svelte';
  import CoverFinder from './components/sheets/CoverFinder.svelte';
  import CropSheet from './components/sheets/CropSheet.svelte';
  import NewEditionFlow from './components/sheets/NewEditionFlow.svelte';
  import PlateComposer from './components/sheets/PlateComposer.svelte';
  import ProofSheet from './components/sheets/ProofSheet.svelte';
  import ReportPreview from './components/sheets/ReportPreview.svelte';
  import SettingsSheet from './components/sheets/SettingsSheet.svelte';
  import ConfirmModal from './components/ui/ConfirmModal.svelte';
  import Icon from './components/ui/Icon.svelte';
  import { IconTabs, ThemeToggle, Toast, konami, play, secretTaps } from 'dusk-dawn';
  import { cheer, hatch } from './lib/delight';

  const TABS: { id: Tab; label: string; icon: Snippet }[] = [
    { id: 'inspection', label: 'Inspection', icon: inspectionIcon },
    { id: 'imprint', label: 'Imprint', icon: imprintIcon },
    { id: 'chapters', label: 'Chapters', icon: chaptersIcon },
    { id: 'catalog', label: 'Catalog', icon: catalogIcon },
  ];
  const tabs = $derived(
    TABS.map((t) => ({
      ...t,
      domId: `tab-${t.id}`,
      controls: `view-${t.id}`,
      badge: t.id === 'inspection' && bench.issues.length ? bench.issues.length : undefined,
    })),
  );
  const tier = $derived(tierOf(bench.audit.score));
  // The eyebrow is the date, as in the other apps (style.md §8.8).
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  let dropping = $state(false);

  $effect(() => applyTheme(settings.value.theme));
  // A light tap when an edit lifts the edition into a better tier.
  $effect(() => {
    void bench.audit.score;
    if (bench.edition) bench.noteTier();
  });

  function close() {
    ui.close();
  }

  // Drop an EPUB anywhere on the page.
  function dragover(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dropping = true;
  }
  async function drop(e: DragEvent) {
    e.preventDefault();
    dropping = false;
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => /\.epub$/i.test(f.name) || f.type === 'application/epub+zip');
    if (file) await bench.openBytes(new Uint8Array(await file.arrayBuffer()), file.name);
    else if (e.dataTransfer?.files.length) ui.notify('That isn’t an EPUB. Drop a .epub file.', 'error');
  }

  async function openFile() {
    const file = await pickFile(EPUB_ACCEPT);
    if (file) await bench.openBytes(await fileBytes(file), file.name);
  }

  // Keyboard shortcuts, for the browser and a keyboard on a tablet. Listed in Settings.
  function keydown(e: KeyboardEvent) {
    const action = shortcut(e, { overlay: ui.overlay !== null || ui.confirmRequest !== null, edition: !!bench.edition });
    if (!action) return;
    e.preventDefault();
    if (action === 'bind') {
      if (bench.busy === null) void (bench.changes ? bench.bindAndSave() : ui.notify('Nothing to bind yet. The edition is as it was opened.'));
    } else if (action === 'open') void openFile();
    else if (action === 'undo') {
      if (ui.toast?.action?.label === 'Undo') ui.actOnToast();
    } else if (action === 'proof') ui.open('proof');
    else ui.go(action.tab);
  }

  // Easter eggs (style.md §11.3). The Konami code lets the printer's devil
  // loose in the type case; seven taps on the title mark it stet.
  let titleWord = $state<HTMLElement>();
  $effect(() =>
    konami(() => {
      cheer(null, { count: 90, spread: 1.3 });
      hatch('konami', "The printer's devil was here.");
    }),
  );
  function stet() {
    play(titleWord, 'flip');
    hatch('title', 'Stet. Let it stand.');
  }

  // Binding is the press closing on the forme: the button gives a satisfied bounce when it worked.
  async function bindNow(button: HTMLElement) {
    const id = bench.id;
    const before = id ? library.get(id)?.boundAt : undefined;
    await bench.bindAndSave();
    if (id && library.get(id)?.boundAt !== before) play(button, 'jelly');
  }
</script>

{#snippet inspectionIcon()}<Icon name="book-check" />{/snippet}
{#snippet imprintIcon()}<Icon name="tags" />{/snippet}
{#snippet chaptersIcon()}<Icon name="list-tree" />{/snippet}
{#snippet catalogIcon()}<Icon name="library" />{/snippet}

<svelte:window onkeydown={keydown} ondragover={dragover} ondragleave={(e) => e.relatedTarget === null && (dropping = false)} ondrop={(e) => void drop(e)} />

<div class="glow-layer" aria-hidden="true">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="glow glow-3"></div>
</div>

<div class="container">
  <header class="site-header">
    <div class="site-title">
      <p class="eyebrow">{today}</p>
      <h1 class="t-page-title" use:secretTaps={{ count: 7, onunlock: stet }}>The <em class="title-word" bind:this={titleWord}>Colophon</em></h1>
      <p class="t-tagline">Audit, imprint, sequence and catalog an EPUB edition.</p>
    </div>
    <div class="header-tools">
      <ThemeToggle dawn={!shown.dark} label="Dawn theme" ontoggle={() => void settings.update({ theme: toggledTheme() })} />
      <button type="button" class="btn-icon" id="openSettings" aria-label="Settings" onclick={() => ui.open('settings')}><Icon name="settings" /></button>
    </div>
  </header>

  {#if bench.edition}
    <div class="file-bar edition-bar">
      <button type="button" class="btn-icon" id="backToBench" aria-label="Back to the bench" onclick={() => bench.close()}><Icon name="arrow-left" /></button>
      <h2 class="t-card-title ellipsis edition-bar-title" id="barTitle">{bench.draft.meta.title || 'Untitled edition'}</h2>
      <p class="t-data-small dim ellipsis edition-bar-meta">
        <span style:color={tierText(tier)}>{bench.audit.score} · {tier.name}</span>
        {#if bench.changes}· <button type="button" class="link-inline amber" id="changeCount" aria-haspopup="dialog" onclick={() => ui.open('proof')}>{plural(bench.changes, 'change')} to bind</button>{:else}· {bench.edition.fileName}{/if}
      </p>
      <button type="button" class="btn btn-primary edition-bar-bind" id="bindEpub" disabled={bench.busy !== null} onclick={(e) => void bindNow(e.currentTarget)}>
        <Icon name="book-check" />{bench.busy === 'binding' ? 'Binding…' : 'Bind'}
      </button>
    </div>

    <nav class="app-tabs" aria-label="Edition">
      <IconTabs {tabs} value={ui.tab} label="Edition" onselect={(id) => ui.go(id)} />
    </nav>

    {#key bench.id}
      <main>
      <div id="view-{ui.tab}" role="tabpanel" aria-labelledby="tab-{ui.tab}">
        {#if ui.tab === 'inspection'}
          <InspectionView />
        {:else if ui.tab === 'imprint'}
          <ImprintView />
        {:else if ui.tab === 'chapters'}
          <ChaptersView />
        {:else}
          <CatalogView />
        {/if}
      </div>
      </main>
    {/key}
  {:else}
    <main><LibraryView /></main>
  {/if}
</div>

{#if dropping}
  <div class="drop-veil" aria-hidden="true">
    <div class="drop-card">
      <Icon name="book-open" />
      <p class="t-verdict">Drop the <em>EPUB</em></p>
      <p class="t-hint">It opens on the bench. Edits to the current edition are already saved.</p>
    </div>
  </div>
{/if}

{#if ui.overlay === 'settings'}
  <SettingsSheet onclose={close} />
{:else if ui.overlay === 'builder'}
  <NewEditionFlow onclose={close} />
{:else if bench.edition}
  {#if ui.overlay === 'coverFinder'}
    <CoverFinder onclose={close} onpick={() => ui.open('crop')} />
  {:else if ui.overlay === 'plate'}
    <PlateComposer onclose={close} />
  {:else if ui.overlay === 'crop' && ui.cropImage}
    <CropSheet onclose={() => ((ui.cropImage = null), close())} />
  {:else if ui.overlay === 'preview'}
    <ChapterPreview onclose={close} />
  {:else if ui.overlay === 'altText'}
    <AltTextSheet onclose={close} />
  {:else if ui.overlay === 'a11y'}
    <A11ySheet onclose={close} />
  {:else if ui.overlay === 'report'}
    <ReportPreview onclose={close} />
  {:else if ui.overlay === 'proof'}
    <ProofSheet onclose={close} />
  {/if}
{/if}

<ConfirmModal />

<IdleDock label="A composing stick" disabled={!!ui.overlay || bench.busy !== null}><IdleStick /></IdleDock>

<Toast toast={ui.toast} onpause={() => ui.pauseToast()} onresume={() => ui.resumeToast()} onaction={() => ui.actOnToast()} />
