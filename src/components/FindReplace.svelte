<script lang="ts">
  // Find and replace across every chapter's text (src/epub/find-replace.ts):
  // the matches are listed in context first, chapter by chapter, and one tap
  // replaces them all, with Undo.
  import { findInChapters } from '../epub/find-replace';
  import { plural } from '../lib/format';
  import { bench } from '../state/bench.svelte';
  import Icon from './ui/Icon.svelte';

  let query = $state('');
  let replacement = $state('');
  let matchCase = $state(false);
  let wholeWord = $state(false);

  const options = $derived({ matchCase, wholeWord });
  const found = $derived(bench.edition && query ? findInChapters(bench.edition, bench.draft, query, options) : []);
  const total = $derived(found.reduce((n, c) => n + c.count, 0));

  function replaceAll() {
    if (bench.replaceAll(query, replacement, options)) query = '';
  }
</script>

<div class="section-head">
  <h2 class="t-section-heading" id="findHeading">Find and <em>replace</em></h2>
</div>
<div class="panel form-stack">
  <div class="pair-grid">
    <label class="field">
      <span class="t-field-label">Find</span>
      <input class="input" id="findText" type="search" bind:value={query} autocomplete="off" spellcheck="false" />
    </label>
    <label class="field">
      <span class="t-field-label">Replace with</span>
      <input class="input" id="replaceText" bind:value={replacement} autocomplete="off" spellcheck="false" />
    </label>
  </div>
  <div class="chip-row">
    <button type="button" class="chip" aria-pressed={matchCase} onclick={() => (matchCase = !matchCase)}>Match case</button>
    <button type="button" class="chip" aria-pressed={wholeWord} onclick={() => (wholeWord = !wholeWord)}>Whole words</button>
  </div>
  <p class="field-hint">Only the text you read changes; the markup, links and styles are left alone.</p>
  {#if query}
    <p class="t-data-small" id="findCount" role="status">
      {total ? `${plural(total, 'match', 'matches')} in ${plural(found.length, 'chapter')}` : 'No matches'}
    </p>
    {#if found.length}
      <ul class="find-results" aria-label="Matches">
        {#each found as chapter (chapter.path)}
          <li>
            <p class="t-card-title find-chapter">{chapter.title} <span class="t-data-small dim tabular">{chapter.count}</span></p>
            {#each chapter.samples as s, i (i)}
              <p class="t-body-small find-sample">{s.before}<mark>{s.match}</mark>{s.after}</p>
            {/each}
          </li>
        {/each}
      </ul>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="replaceAll" onclick={replaceAll}><Icon name="wrench" />Replace {plural(total, 'match', 'matches')}</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .find-results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-height: 22rem;
    overflow-y: auto;
  }
  .find-chapter {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    overflow-wrap: anywhere;
  }
  .find-sample {
    color: var(--text-dim);
    overflow-wrap: anywhere;
  }
  .find-sample mark {
    background: rgba(var(--accent-amber-rgb), 0.25);
    color: var(--text-heading);
    border-radius: 2px;
  }
</style>
