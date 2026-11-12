<script lang="ts">
  // Catalog: search Google Books, Open Library and ISBNdb by title or ISBN
  // (typed or scanned), compare a record with the imprint, import fields.
  // Searches are cached, so the last results are there with the radio off.
  import { fetchCover } from '../catalog/cover';
  import { recentQueries } from '../catalog/cache';
  import { formatIsbn, isbnFromBarcode } from '../catalog/isbn';
  import { defaultQuery, searchCatalogs, type ScoredRecord, type SearchScope } from '../catalog/search';
  import { SOURCE_NAMES } from '../catalog/types';
  import type { Meta } from '../epub/types';
  import { relativeDay } from '../lib/format';
  import { canScanBarcodes, scanBarcode } from '../platform/barcode';
  import { bench } from '../state/bench.svelte';
  import { settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import Icon from './ui/Icon.svelte';
  import Notice from './ui/Notice.svelte';

  const meta = $derived(bench.draft.meta);
  let query = $state(defaultQuery(bench.draft.meta));
  let scope = $state<SearchScope>('all');
  let results = $state.raw<ScoredRecord[]>([]);
  let searching = $state(false);
  let searched = $state(false);
  let cachedAt = $state<number | null>(null);
  let failed = $state<string[]>([]);
  let online = $state(navigator.onLine !== false);
  let recent = $state<string[]>([]);
  let picked = $state.raw<ScoredRecord | null>(null);
  let fields = $state<Record<string, boolean>>({});
  let fetchingCover = $state(false);

  const SCOPES = $derived([
    { id: 'all', label: 'All' },
    { id: 'google', label: 'Google' },
    { id: 'openlibrary', label: 'Open Library' },
    ...(settings.secrets.isbndbApiKey ? [{ id: 'isbndb', label: 'ISBNdb' }] : []),
  ] as { id: SearchScope; label: string }[]);

  $effect(() => {
    const on = () => (online = true);
    const off = () => (online = false);
    addEventListener('online', on);
    addEventListener('offline', off);
    void recentQueries().then((q) => (recent = q));
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  });

  async function search(q = query) {
    query = q.trim();
    if (!query || searching) return;
    searching = true;
    picked = null;
    try {
      const out = await searchCatalogs(query, scope, settings.catalogKeys, settings.value.maxCatalogResults, $state.snapshot(meta) as Meta, { online });
      results = out.results;
      cachedAt = out.cachedAt;
      failed = out.failed.map((s) => SOURCE_NAMES[s]);
      searched = true;
      recent = await recentQueries();
    } catch (err) {
      ui.notify(`The search failed (${err instanceof Error ? err.message : String(err)}).`, 'error');
    } finally {
      searching = false;
    }
  }

  async function scan() {
    try {
      const code = await scanBarcode();
      if (!code) return;
      const isbn = isbnFromBarcode(code);
      if (!isbn) {
        ui.notify(`That barcode (${code}) isn't an ISBN. Try the one with 978 or 979.`, 'error');
        return;
      }
      await search(isbn);
    } catch (err) {
      ui.notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  type FieldKey = keyof Meta;
  const FIELDS: { key: FieldKey; label: string }[] = [
    { key: 'title', label: 'Title' },
    { key: 'creator', label: 'Author' },
    { key: 'identifier', label: 'ISBN' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'date', label: 'Date' },
    { key: 'language', label: 'Language' },
    { key: 'subjects', label: 'Subjects' },
    { key: 'description', label: 'Synopsis' },
  ];

  const show = (v: string | string[]) => (Array.isArray(v) ? v.join(', ') : v);
  const rows = $derived(
    picked
      ? FIELDS.map((f) => ({ ...f, current: show(meta[f.key]), online: show(picked![f.key as keyof ScoredRecord] as string | string[]) })).filter((r) => r.online && r.online !== r.current)
      : [],
  );

  function compare(record: ScoredRecord) {
    picked = record;
    fields = Object.fromEntries(FIELDS.map((f) => [f.key, !show(meta[f.key])]));
  }

  function importPicked() {
    if (!picked) return;
    const out: Partial<Meta> = {};
    for (const row of rows) {
      if (!fields[row.key]) continue;
      const value = picked[row.key as keyof ScoredRecord];
      (out as Record<string, unknown>)[row.key] = Array.isArray(value) ? [...value] : value;
    }
    if (!Object.keys(out).length) return;
    bench.importFields(out, SOURCE_NAMES[picked.source]);
    picked = null;
  }

  async function useCover() {
    if (!picked?.coverUrl) return;
    fetchingCover = true;
    try {
      ui.cropImage = await fetchCover(picked.coverUrl, settings.value.corsProxyUrl);
      ui.open('crop');
    } catch (err) {
      ui.notify(`Couldn't download the cover (${err instanceof Error ? err.message : String(err)}).`, 'error');
    } finally {
      fetchingCover = false;
    }
  }
</script>

<section class="section-block" aria-labelledby="searchHeading">
  <div class="section-head">
    <h2 class="t-section-heading" id="searchHeading">Search <em>catalogs</em></h2>
  </div>
  <form
    class="search-row"
    onsubmit={(e) => {
      e.preventDefault();
      void search();
    }}
  >
    <input class="input" type="search" id="catalogQuery" bind:value={query} placeholder="Title, author or ISBN" enterkeyhint="search" autocomplete="off" />
    {#if canScanBarcodes()}
      <button type="button" class="btn-icon" id="scanIsbn" aria-label="Scan an ISBN barcode" onclick={() => void scan()}><Icon name="scan-barcode" /></button>
    {/if}
    <button type="submit" class="btn btn-secondary" id="catalogSearch" disabled={searching || !query.trim()}>{searching ? 'Searching…' : 'Search'}</button>
  </form>
  <div class="segmented" role="radiogroup" aria-label="Catalogs">
    {#each SCOPES as s (s.id)}<button type="button" role="radio" aria-checked={scope === s.id} onclick={() => (scope = s.id)}>{s.label}</button>{/each}
  </div>

  {#if !online}
    <Notice icon="wifi-off" title="You're offline" detail="Searches you've made before still show their saved results." />
  {:else if cachedAt}
    <Notice icon="history" title="Saved results from {relativeDay(cachedAt)}" detail="A catalog didn't answer, so these come from the last search for the same words." />
  {/if}
  {#if failed.length}
    {#if results.length}
      <Notice title="{failed.join(' and ')} didn't answer" detail="These results are from the other catalogs." />
    {:else}
      <Notice kind="error" title="{failed.join(' and ')} didn't answer" detail={online ? 'Try again in a moment.' : 'Reconnect, then search again.'} />
    {/if}
  {/if}

  {#if recent.length && !searched}
    <div class="chip-row recent-row" aria-label="Recent searches">
      {#each recent as r (r)}<button type="button" class="chip" onclick={() => void search(r)}><Icon name="history" />{r}</button>{/each}
    </div>
  {/if}
</section>

{#if picked}
  {@const record = picked}
  <section class="section-block" aria-labelledby="compareHeading">
    <div class="section-head">
      <h2 class="t-section-heading" id="compareHeading"><em>Compare</em></h2>
      <span class="t-data-small dim">{SOURCE_NAMES[record.source]} · {record.confidence}% match</span>
    </div>
    <div class="panel compare-panel">
      {#if !rows.length}
        <p class="empty-match">This record matches the imprint already.</p>
      {/if}
      {#each rows as row (row.key)}
        <label class="compare-row">
          <input type="checkbox" class="check" bind:checked={fields[row.key]} />
          <span class="compare-field">
            <span class="t-field-label">{row.label}</span>
            <span class="compare-values">
              <span class="compare-old" class:struck={fields[row.key] && row.current}>{row.current || 'Empty'}</span>
              <span class="compare-new">{row.key === 'identifier' ? formatIsbn(row.online) : row.online}</span>
            </span>
          </span>
        </label>
      {/each}
      <div class="btn-row">
        <button type="button" class="btn btn-muted" onclick={() => (picked = null)}>Back</button>
        {#if record.coverUrl}<button type="button" class="btn btn-secondary" disabled={fetchingCover} onclick={() => void useCover()}><Icon name="image" />{fetchingCover ? 'Downloading…' : 'Use cover'}</button>{/if}
        <button type="button" class="btn btn-primary" id="importFields" disabled={!rows.some((r) => fields[r.key])} onclick={importPicked}>Import {rows.filter((r) => fields[r.key]).length}</button>
      </div>
    </div>
  </section>
{:else if searched}
  {#if !results.length}
    <p class="empty-match">Nothing found. Try fewer words, or the ISBN.</p>
  {:else}
    <ul class="result-list" aria-label="Results">
      {#each results as record, i (`${record.source}:${record.identifier}:${i}`)}
        <li>
          <button type="button" class="panel result-card" onclick={() => compare(record)}>
            <span class="result-thumb" aria-hidden="true">
              {#if record.coverUrl}<img src={record.coverUrl.replace(/^http:/, 'https:')} alt="" loading="lazy" referrerpolicy="no-referrer" />{:else}<Icon name="book" />{/if}
            </span>
            <span class="result-text">
              <span class="t-card-title ellipsis-2">{record.title || 'Untitled'}</span>
              <span class="dim ellipsis">{record.creator || 'Unknown author'}</span>
              <span class="t-data-small faint">{[record.publisher, record.date.slice(0, 4), record.identifier && formatIsbn(record.identifier)].filter(Boolean).join(' · ')}</span>
            </span>
            <span class="result-score">
              <span class="t-stat tabular" class:amber={record.confidence >= 80}>{record.confidence}%</span>
              <span class="t-field-label">{SOURCE_NAMES[record.source].split(' ')[0]}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
