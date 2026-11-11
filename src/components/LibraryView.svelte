<script lang="ts">
  // The library bench: recent editions as cards with their scores. A long
  // press selects editions for batch fixes, removal or sending to BookShelf.
  import { tierOf } from '../epub/audit';
  import { sampleEpub } from '../epub/sample';
  import { plural } from '../lib/format';
  import { EPUB_ACCEPT, fileBytes, pickFile } from '../lib/pick';
  import { sendToBookShelf as linkToBookShelf } from '../platform/handoff';
  import { shareText } from '../platform/output';
  import { sampleCover } from '../render/plate';
  import { bench } from '../state/bench.svelte';
  import { library } from '../state/library.svelte';
  import type { BenchSort } from '../state/settings';
  import { settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import BatchSheet from './BatchSheet.svelte';
  import EditionCard from './EditionCard.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Icon from './ui/Icon.svelte';

  let batchOpen = $state(false);
  let query = $state('');
  const selecting = $derived(library.selected.length > 0);
  const sort = $derived(settings.value.benchSort);
  /** The filter shows once the bench is long enough to need one. */
  const FILTER_FROM = 6;

  const SORTS: { id: BenchSort; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'score', label: 'Score' },
    { id: 'title', label: 'Title' },
  ];

  /** "The Waves" files under W, as on a shelf. */
  const shelfKey = (title: string) => title.trim().replace(/^(the|a|an)\s+/i, '');

  const shown = $derived.by(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length
      ? library.items.filter((e) => {
          const hay = `${e.title} ${e.creator} ${e.fileName}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        })
      : [...library.items];
    if (sort === 'score') list.sort((a, b) => a.score - b.score || b.openedAt - a.openedAt);
    else if (sort === 'title') list.sort((a, b) => shelfKey(a.title || a.fileName).localeCompare(shelfKey(b.title || b.fileName), undefined, { numeric: true, sensitivity: 'base' }));
    return list;
  });

  const summary = $derived.by(() => {
    const items = library.items;
    const ready = items.filter((e) => tierOf(e.score).name === 'Ready').length;
    const unsaved = items.filter((e) => e.draft).length;
    const mean = items.length ? Math.round(items.reduce((sum, e) => sum + e.score, 0) / items.length) : 0;
    return { ready, unsaved, mean };
  });

  export async function openFile() {
    const file = await pickFile(EPUB_ACCEPT);
    if (file) await bench.openBytes(await fileBytes(file), file.name);
  }

  async function openSample() {
    await bench.openBytes(sampleEpub(await sampleCover()), 'the-art-of-digital-bookmaking.epub');
  }

  async function remove() {
    const ids = [...library.selected];
    const undo = await library.remove(ids);
    ui.undoable(`Removed ${plural(ids.length, 'edition')} from the bench.`, () => void undo());
  }

  async function sendToBookShelf() {
    const picked = library.selected.map((id) => library.get(id)).filter((e) => !!e);
    // One edition goes by BookShelf's link (style.md §14.1); several go as a list of lines.
    if (picked.length === 1 && (await linkToBookShelf({ title: picked[0]!.title, creator: picked[0]!.creator }))) {
      library.clearSelection();
      return;
    }
    const lines = picked.map((e) => (e.creator ? `${e.title} by ${e.creator}` : e.title));
    const sent = await shareText(lines.length === 1 ? lines[0]! : 'Editions from Colophon', lines.join('\n'));
    if (!sent) ui.notify(`Copied ${plural(lines.length, 'title')}. Paste into BookShelf to add.`, 'success');
    library.clearSelection();
  }

  $effect(() => {
    if (!selecting) return;
    return ui.pushOverlay(() => library.clearSelection());
  });
</script>

{#if library.loaded && !library.items.length}
  <EmptyState icon="book-open" title="No edition on the bench" text="Open an EPUB to inspect it, mend its imprint and cover, and bind a clean copy. Or set one in type from a manuscript.">
    <button type="button" class="btn btn-primary" id="openEpub" onclick={() => void openFile()}><Icon name="folder-open" />Open EPUB</button>
    <button type="button" class="btn btn-secondary" id="newEdition" onclick={() => ui.open('builder')}><Icon name="feather" />New edition</button>
    <button type="button" class="btn btn-muted" id="trySample" onclick={() => void openSample()}>Try a sample</button>
  </EmptyState>
{:else}
  <section class="section-block" aria-labelledby="benchHeading">
    <div class="section-head">
      <h2 class="t-section-heading" id="benchHeading">The <em>bench</em></h2>
      <span class="t-data-small dim">{plural(library.items.length, 'edition')}</span>
    </div>
    {#if library.items.length > 1}
      <p class="t-data-small dim shelf-line" id="shelfLine">
        <span>Average <span class="tabular" style:color="var({tierOf(summary.mean).cssVar})">{summary.mean}</span></span>
        <span>· {summary.ready} ready to shelve</span>
        {#if summary.unsaved}<span>· <span class="amber">{summary.unsaved} with unsaved edits</span></span>{/if}
      </p>
    {/if}
    <div class="btn-row btn-row-start">
      <button type="button" class="btn btn-primary" id="openEpub" onclick={() => void openFile()}><Icon name="folder-open" />Open EPUB</button>
      <button type="button" class="btn btn-secondary" id="newEdition" onclick={() => ui.open('builder')}><Icon name="feather" />New edition</button>
      <button type="button" class="btn btn-muted" onclick={() => void openSample()}>Sample</button>
    </div>
    {#if library.items.length > 1}
      <div class="bench-tools">
        <div class="segmented" role="radiogroup" aria-label="Order the bench by">
          {#each SORTS as s (s.id)}
            <button type="button" role="radio" aria-checked={sort === s.id} onclick={() => void settings.update({ benchSort: s.id })}>{s.label}</button>
          {/each}
        </div>
        {#if library.items.length >= FILTER_FROM}
          <input class="input" type="search" id="benchFilter" placeholder="Find by title, author or file" aria-label="Find an edition" enterkeyhint="search" autocomplete="off" bind:value={query} />
        {/if}
      </div>
    {/if}
    <p class="field-hint bench-hint">
      {sort === 'score' ? 'Weakest first, so the next one to mend is at the top. ' : ''}Long-press an edition to select several for batch fixes.
    </p>
    {#if !shown.length}
      <p class="empty-match">No edition matches “{query.trim()}”.</p>
      <div class="btn-row"><button type="button" class="btn btn-muted" onclick={() => (query = '')}>Clear filter</button></div>
    {/if}
    <ul class="edition-list dd-stagger" aria-label="Recent editions">
      {#each shown as edition (edition.id)}
        <li>
          <EditionCard
            {edition}
            {selecting}
            selected={library.selected.includes(edition.id)}
            onopen={() => void bench.openStored(edition.id)}
            ontoggle={() => library.toggle(edition.id)}
          />
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if selecting}
  <div class="batch-bar" role="toolbar" aria-label="Selected editions">
    <button type="button" class="btn-icon" aria-label="Clear selection" onclick={() => library.clearSelection()}><Icon name="x" /></button>
    <span class="batch-count tabular" aria-live="polite">{library.selected.length} selected</span>
    <button type="button" class="btn-icon" aria-label="Send to BookShelf" onclick={() => void sendToBookShelf()}><Icon name="library" /></button>
    <button type="button" class="btn-icon" aria-label="Remove from the bench" onclick={() => void remove()}><Icon name="trash-2" /></button>
    <button type="button" class="btn btn-primary" id="batchFix" onclick={() => (batchOpen = true)}><Icon name="wrench" />Fix</button>
  </div>
{/if}

{#if batchOpen}
  <BatchSheet onclose={() => (batchOpen = false)} />
{/if}
