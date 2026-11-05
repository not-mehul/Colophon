<script lang="ts">
  import { tierOf } from './epub/audit';
  import { plural } from './lib/format';
  import { applyTheme, shown, toggledTheme } from './platform/theme.svelte';
  import { EPUB_ACCEPT, fileBytes, pickFile } from './lib/pick';
  import { shortcut } from './lib/keys';
  import { sendToBookShelf } from './platform/handoff';
  import { shareText } from './platform/output';
  import { bench } from './state/bench.svelte';
  import { settings } from './state/settings.svelte';
  import { ui, type Tab } from './state/ui.svelte';
  import CatalogView from './components/CatalogView.svelte';
  import ChaptersView from './components/ChaptersView.svelte';
  import ImprintView from './components/ImprintView.svelte';
  import InspectionView from './components/InspectionView.svelte';
  import LibraryView from './components/LibraryView.svelte';
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
  import { TabRail, ThemeToggle, Toast } from 'dusk-dawn';

  const TABS: { id: Tab; label: string }[] = [
    { id: 'inspection', label: 'Inspection' },
    { id: 'imprint', label: 'Imprint' },
    { id: 'chapters', label: 'Chapters' },
    { id: 'catalog', label: 'Catalog' },
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

  async function toBookShelf() {
    const { title, creator, identifier } = bench.draft.meta;
    // BookShelf's own link first (style.md §14.1); the share sheet when it isn't installed.
    if (await sendToBookShelf({ title, creator, isbn: identifier })) return;
    const line = creator ? `${title} by ${creator}` : title;
    if (!(await shareText(line, line))) ui.notify('Copied. Paste into BookShelf to add it.', 'success');
  }
</script>

<svelte:window onkeydown={keydown} ondragover={dragover} ondragleave={(e) => e.relatedTarget === null && (dropping = false)} ondrop={(e) => void drop(e)} />

<div class="glow-layer" aria-hidden="true">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="glow glow-3"></div>
</div>

<div class="container">
  <header class="site-header">
    <div class="site-title">
      <p class="eyebrow">Colophon · Edition inspector</p>
      <h1 class="t-page-title">The <em>Colophon</em></h1>
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
      <div class="edition-bar-text">
        <h2 class="t-card-title ellipsis" id="barTitle">{bench.draft.meta.title || 'Untitled edition'}</h2>
        <p class="t-data-small dim ellipsis">
          <span style:color="var({tier.cssVar})">{bench.audit.score} · {tier.name}</span>
          {#if bench.changes}· <button type="button" class="link-inline amber" id="changeCount" aria-haspopup="dialog" onclick={() => ui.open('proof')}>{plural(bench.changes, 'change')} to bind</button>{:else}· {bench.edition.fileName}{/if}
        </p>
      </div>
      <div class="edition-bar-actions">
        <button type="button" class="btn-icon" aria-label="Send to BookShelf" onclick={() => void toBookShelf()}><Icon name="library" /></button>
        <button type="button" class="btn-icon" id="shareEpub" aria-label="Share the EPUB" onclick={() => void bench.share()}><Icon name="share-2" /></button>
        <button type="button" class="btn btn-primary" id="bindEpub" disabled={bench.busy !== null} onclick={() => void bench.bindAndSave()}>
          <Icon name="book-check" />{bench.busy === 'binding' ? 'Binding…' : 'Bind'}
        </button>
      </div>
    </div>

    <nav class="app-tabs" aria-label="Edition">
      <TabRail {tabs} value={ui.tab} label="Edition" onselect={(id) => ui.go(id)} />
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
  <div class="drop-veil" aria-hidden="true"><p class="t-verdict">Drop the EPUB to open it</p></div>
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

<Toast toast={ui.toast} onpause={() => ui.pauseToast()} onresume={() => ui.resumeToast()} onaction={() => ui.actOnToast()} />
