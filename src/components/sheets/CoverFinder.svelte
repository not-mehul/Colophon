<script lang="ts">
  // Find a cover online: the catalogs' covers for the imprint's ISBN or title.
  import { fetchCover } from '../../catalog/cover';
  import { searchCatalogs, type ScoredRecord } from '../../catalog/search';
  import { SOURCE_NAMES } from '../../catalog/types';
  import type { Meta } from '../../epub/types';
  import { bench } from '../../state/bench.svelte';
  import { settings } from '../../state/settings.svelte';
  import { ui } from '../../state/ui.svelte';
  import Sheet from '../ui/Sheet.svelte';

  let { onclose, onpick }: { onclose: () => void; onpick: () => void } = $props();
  const meta = $state.snapshot(bench.draft.meta) as Meta;
  let query = $state(meta.identifier || [meta.title, meta.creator.split(',')[0]].filter(Boolean).join(' '));
  let results = $state.raw<ScoredRecord[]>([]);
  let loading = $state(false);
  let fetching = $state<string | null>(null);

  async function search() {
    if (!query.trim()) return;
    loading = true;
    try {
      const out = await searchCatalogs(query.trim(), 'all', settings.catalogKeys, 12, meta);
      results = out.results.filter((r) => r.coverUrl);
    } finally {
      loading = false;
    }
  }

  async function pick(record: ScoredRecord) {
    fetching = record.coverUrl;
    try {
      ui.cropImage = await fetchCover(record.coverUrl, settings.value.corsProxyUrl);
      onpick();
    } catch (err) {
      ui.notify(`Couldn't download that cover (${err instanceof Error ? err.message : String(err)}).`, 'error');
    } finally {
      fetching = null;
    }
  }

  $effect(() => {
    void search();
  });
</script>

<Sheet title="Find a cover online" {onclose}>
  <form
    class="search-row"
    onsubmit={(e) => {
      e.preventDefault();
      void search();
    }}
  >
    <input class="input" type="search" bind:value={query} aria-label="Search for a cover" enterkeyhint="search" />
    <button type="submit" class="btn btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
  </form>
  {#if !loading && !results.length}
    <p class="empty-match">No covers found. Try the ISBN, or fewer words.</p>
  {/if}
  <ul class="cover-grid">
    {#each results as r, i (`${r.coverUrl}${i}`)}
      <li>
        <button type="button" class="cover-pick" disabled={!!fetching} aria-label="{r.title}, from {SOURCE_NAMES[r.source]}" onclick={() => void pick(r)}>
          <img src={r.coverUrl.replace(/^http:/, 'https:')} alt="" loading="lazy" referrerpolicy="no-referrer" />
          <span class="t-data-small faint">{fetching === r.coverUrl ? 'Downloading…' : SOURCE_NAMES[r.source]}</span>
        </button>
      </li>
    {/each}
  </ul>
</Sheet>
