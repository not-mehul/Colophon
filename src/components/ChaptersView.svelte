<script lang="ts">
  // Chapters: reading order, file names, the contents and the bound file's name.
  import { DEFAULT_RENAME, TEMPLATE_FIELDS, TEMPLATE_PRESETS } from '../epub/filename';
  import { bench } from '../state/bench.svelte';
  import { settings } from '../state/settings.svelte';
  import ChapterOrder from './ChapterOrder.svelte';
  import ChapterShape from './ChapterShape.svelte';
  import TocEditor from './TocEditor.svelte';
  import Icon from './ui/Icon.svelte';

  let pattern = $state(settings.value.renamePattern || DEFAULT_RENAME);
  let start = $state(1);
  let digits = $state(3);
  let numbering = $state(false);
</script>

<section class="section-block" aria-labelledby="orderHeading">
  <div class="section-head">
    <h2 class="t-section-heading" id="orderHeading">Reading <em>order</em></h2>
    <button type="button" class="btn btn-muted section-head-action" id="resetOrder" onclick={() => bench.resetChapters()}>Reset</button>
  </div>
  <div class="chip-row">
    <button type="button" class="chip" onclick={() => bench.sortChapters('title')}><Icon name="arrow-down-a-z" />By heading</button>
    <button type="button" class="chip" onclick={() => bench.sortChapters('name')}><Icon name="file-text" />By file name</button>
    <button type="button" class="chip" onclick={() => bench.sortChapters('reverse')}><Icon name="arrow-up-down" />Reverse</button>
    <button type="button" class="chip" aria-expanded={numbering} onclick={() => (numbering = !numbering)}><Icon name="list-ordered" />Number files</button>
  </div>
  {#if numbering}
    <div class="panel form-stack number-panel">
      <label class="field">
        <span class="t-field-label">Pattern</span>
        <input class="input input-mono" bind:value={pattern} autocomplete="off" spellcheck="false" />
        <span class="field-hint">{'{num}'} is the position, {'{slug}'} the heading, {'{orig}'} the old name.</span>
      </label>
      <div class="pair-grid">
        <label class="field">
          <span class="t-field-label">Start at</span>
          <input class="input input-mono" type="number" min="0" bind:value={start} />
        </label>
        <div class="field">
          <span class="t-field-label">Digits</span>
          <div class="segmented" role="radiogroup" aria-label="Digits">
            {#each [2, 3, 4] as d (d)}<button type="button" role="radio" aria-checked={digits === d} onclick={() => (digits = d)}>{d}</button>{/each}
          </div>
        </div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="applyNumbering" onclick={() => (bench.numberChapters(pattern, start || 0, digits), (numbering = false))}>Rename {bench.draft.chapters.length} files</button>
      </div>
    </div>
  {/if}
  <ChapterShape />
  <ChapterOrder />
</section>

<section class="section-block" aria-labelledby="tocHeading">
  <TocEditor />
</section>

<section class="section-block" aria-labelledby="nameHeading">
  <div class="section-head">
    <h2 class="t-section-heading" id="nameHeading">The <em>file name</em></h2>
  </div>
  <div class="panel form-stack">
    <div class="pair-grid">
      <label class="field">
        <span class="t-field-label">Template</span>
        <input class="input input-mono" id="exportTemplate" value={settings.value.exportTemplate} spellcheck="false" autocomplete="off" oninput={(e) => void settings.update({ exportTemplate: e.currentTarget.value })} />
      </label>
      <label class="field">
        <span class="t-field-label">Shelf order</span>
        <input class="input input-mono" id="shelfOrder" value={settings.value.shelfOrder} autocomplete="off" oninput={(e) => void settings.update({ shelfOrder: e.currentTarget.value })} />
      </label>
    </div>
    <div class="chip-row">
      {#each TEMPLATE_PRESETS as preset (preset.template)}
        <button type="button" class="chip" aria-pressed={settings.value.exportTemplate === preset.template} onclick={() => void settings.update({ exportTemplate: preset.template })}>{preset.label}</button>
      {/each}
    </div>
    <p class="field-hint">Fields: {TEMPLATE_FIELDS.join(' ')}</p>
    <p class="filename-preview t-data" id="exportName">{bench.exportName}</p>
  </div>
</section>
