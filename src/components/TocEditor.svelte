<script lang="ts">
  import { Select } from 'dusk-dawn';
  // The table of contents, written to both the EPUB 3 nav and the EPUB 2 NCX
  // when binding. Labels, depth, order; entries point at chapters.
  import { splitFragment } from '../epub/paths';
  import type { TocEntry } from '../epub/types';
  import { bench } from '../state/bench.svelte';
  import Icon from './ui/Icon.svelte';

  const entries = $derived(bench.toc);
  const edited = $derived(bench.draft.toc !== null);
  const kinds = $derived([bench.edition?.navPath && 'nav', bench.edition?.ncxPath && 'NCX'].filter(Boolean).join(' and ') || 'nav and NCX, created when you bind');
  const chapterTitle = $derived(new Map((bench.edition?.chapters ?? []).map((c) => [c.path, c.title])));
  const paths = $derived(bench.draft.chapters.map((c) => c.path));

  function edit(change: (list: TocEntry[]) => void) {
    const list = $state.snapshot(entries).map((e) => ({ ...e }));
    change(list);
    bench.setToc(list);
  }

  function setDepth(i: number, by: number) {
    edit((list) => {
      const max = i === 0 ? 0 : list[i - 1]!.depth + 1;
      list[i]!.depth = Math.max(0, Math.min(max, list[i]!.depth + by));
    });
  }

  function moveEntry(i: number, by: number) {
    edit((list) => {
      const j = i + by;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j]!, list[i]!];
      if (list[0]) list[0].depth = 0;
    });
  }

  let adding = $state('');
  function add() {
    if (!adding) return;
    edit((list) => list.push({ label: chapterTitle.get(adding) ?? 'Chapter', target: adding, depth: 0 }));
    adding = '';
  }
</script>

<div class="section-head">
  <h2 class="t-section-heading" id="tocHeading">The <em>contents</em></h2>
  <span class="t-data-small dim">{kinds}</span>
</div>
<div class="btn-row btn-row-start">
  <button type="button" class="btn btn-secondary" onclick={() => bench.rebuildToc()}><Icon name="list-restart" />From chapters</button>
  <button type="button" class="btn btn-muted" onclick={() => bench.orderToc()}><Icon name="list-ordered" />Reading order</button>
  {#if edited}<button type="button" class="btn btn-muted" onclick={() => bench.withUndo('Contents put back as they were.', () => (bench.draft.toc = null))}>Revert</button>{/if}
</div>
{#if !entries.length}
  <p class="empty-match">No table of contents. Build one from the chapters, and both the nav and the NCX are written when you bind.</p>
{:else}
  <ol class="panel toc-list" aria-labelledby="tocHeading">
    {#each entries as entry, i (i)}
      <li class="toc-row" style:--depth={entry.depth}>
        <div class="toc-main">
          <input class="input toc-label" value={entry.label} aria-label="Entry {i + 1} label" oninput={(e) => edit((list) => (list[i]!.label = e.currentTarget.value))} />
          <span class="t-data-small faint ellipsis">{splitFragment(entry.target)[0].split('/').pop()}{splitFragment(entry.target)[1]}{paths.includes(splitFragment(entry.target)[0]) ? '' : ' · not in the spine'}</span>
        </div>
        <div class="toc-tools">
          <button type="button" class="btn-icon" aria-label="Outdent" disabled={entry.depth === 0} onclick={() => setDepth(i, -1)}><Icon name="indent-decrease" /></button>
          <button type="button" class="btn-icon" aria-label="Indent" disabled={i === 0 || entry.depth > entries[i - 1]!.depth} onclick={() => setDepth(i, 1)}><Icon name="indent-increase" /></button>
          <button type="button" class="btn-icon" aria-label="Move up" disabled={i === 0} onclick={() => moveEntry(i, -1)}><Icon name="arrow-up" /></button>
          <button type="button" class="btn-icon" aria-label="Move down" disabled={i === entries.length - 1} onclick={() => moveEntry(i, 1)}><Icon name="arrow-down" /></button>
          <button type="button" class="btn-icon" aria-label="Remove {entry.label}" onclick={() => edit((list) => list.splice(i, 1))}><Icon name="x" /></button>
        </div>
      </li>
    {/each}
  </ol>
{/if}
<div class="toc-add">
  <Select
    label="Add an entry for a chapter"
    bind:value={adding}
    options={[{ value: '', label: 'Add an entry for…' }, ...bench.draft.chapters.map((c) => ({ value: c.path, label: bench.titles.get(c.id) ?? c.path }))]}
  />
  <button type="button" class="btn btn-secondary" disabled={!adding} onclick={add}>Add</button>
</div>
