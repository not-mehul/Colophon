<script lang="ts">
  // Imprint: the cover and the Dublin Core fields. Every field writes to the
  // draft as it's typed; Reset puts the original back, with Undo.
  import { hatch } from '../lib/delight';
  import { checkIdentifier, formatIsbn } from '../catalog/isbn';
  import { SYNOPSIS_MIN } from '../epub/audit';
  import { imageMime } from '../epub/image-size';
  import { IMAGE_ACCEPT, fileBytes, pickFile } from '../lib/pick';
  import { plural } from '../lib/format';
  import { bench } from '../state/bench.svelte';
  import { ui } from '../state/ui.svelte';
  import BlobImg from './ui/BlobImg.svelte';
  import DateField from './ui/DateField.svelte';
  import Icon from './ui/Icon.svelte';

  const meta = $derived(bench.draft.meta);
  const cover = $derived(bench.cover);
  let subject = $state('');
  /** Fields that no longer read as they did in the file: their label carries a small amber mark. */
  const edited = $derived(new Set(bench.proof.filter((c) => c.id.startsWith('meta:')).map((c) => c.id.slice(5))));
  const idCheck = $derived(checkIdentifier(meta.identifier));
  const synopsis = $derived(meta.description.trim().length);

  async function chooseImage() {
    const file = await pickFile(IMAGE_ACCEPT);
    if (!file) return;
    const bytes = await fileBytes(file);
    ui.cropImage = { bytes, mediaType: file.type || imageMime(bytes) };
    ui.open('crop');
  }

  function cropCurrent() {
    if (!cover) return;
    ui.cropImage = { bytes: cover.bytes, mediaType: cover.mediaType };
    ui.open('crop');
  }

  function addSubject() {
    const values = subject
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s && !meta.subjects.includes(s));
    if (values.length) bench.setMeta('subjects', [...meta.subjects, ...values]);
    subject = '';
  }

  const LANGUAGES = ['en', 'en-GB', 'en-US', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'ru', 'ja', 'zh', 'ko', 'ar', 'he', 'hi'];

  // An easter egg: the oldest placeholder in the trade, typed as a title.
  let lorem = false;
  $effect(() => {
    const typed = /^\s*lorem ipsum\b/i.test(meta.title ?? '');
    if (typed && !lorem) hatch('lorem', 'Lorem ipsum: set in type since the 1500s, and still waiting for the real copy.');
    lorem = typed;
  });
</script>

<section class="section-block" aria-labelledby="coverHeading">
  <div class="section-head">
    <h2 class="t-section-heading" id="coverHeading">The <em>cover</em></h2>
    {#if bench.draft.cover}<span class="chip-status is-active">Replaced</span>{/if}
  </div>
  <div class="panel cover-panel">
    <div class="cover-frame">
      {#if cover}
        <BlobImg bytes={cover.bytes} type={cover.mediaType} alt="The current cover" />
      {:else}
        <span class="cover-empty"><Icon name="image-off" /><span class="t-field-label">No cover</span></span>
      {/if}
    </div>
    <div class="cover-side">
      {#if cover}
        <p class="t-data tabular">{cover.width} × {cover.height} px</p>
        <p class="t-data-small dim">{cover.mediaType.replace('image/', '').toUpperCase()}{cover.width < 1000 ? ' · smaller than ideal' : ''}</p>
      {/if}
      <div class="cover-actions">
        <button type="button" class="btn btn-secondary" id="chooseCover" onclick={() => void chooseImage()}><Icon name="image-up" />Choose image</button>
        <button type="button" class="btn btn-secondary" id="findCover" onclick={() => ui.open('coverFinder')}><Icon name="search" />Find online</button>
        <button type="button" class="btn btn-secondary" id="composePlate" onclick={() => ui.open('plate')}><Icon name="pen-tool" />Compose a plate</button>
        {#if cover}<button type="button" class="btn btn-muted" onclick={cropCurrent}><Icon name="crop" />Crop to 2 : 3</button>{/if}
      </div>
    </div>
  </div>
</section>

<section class="section-block" aria-labelledby="imprintHeading">
  <div class="section-head">
    <h2 class="t-section-heading" id="imprintHeading">The <em>imprint</em></h2>
    <button type="button" class="btn btn-muted section-head-action" id="resetImprint" onclick={() => bench.resetImprint()}>Reset</button>
  </div>
  <div class="panel form-stack">
    <label class="field">
      <span class="t-field-label">Title{#if edited.has('title')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
      <input class="input" id="metaTitle" value={meta.title} oninput={(e) => bench.setMeta('title', e.currentTarget.value)} autocomplete="off" />
    </label>
    <label class="field">
      <span class="t-field-label">Author{#if edited.has('creator')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
      <input class="input" id="metaCreator" value={meta.creator} oninput={(e) => bench.setMeta('creator', e.currentTarget.value)} autocomplete="off" />
      <span class="field-hint">Separate several authors with commas.</span>
    </label>
    <div class="pair-grid">
      <label class="field">
        <span class="t-field-label">ISBN or identifier{#if edited.has('identifier')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
        <input
          class="input input-mono"
          id="metaIdentifier"
          value={meta.identifier}
          inputmode="text"
          aria-describedby="identifierHint"
          aria-invalid={idCheck.kind === 'bad-check' ? 'true' : undefined}
          oninput={(e) => bench.setMeta('identifier', e.currentTarget.value)}
          autocomplete="off"
          spellcheck="false"
        />
        {#if idCheck.kind === 'isbn13'}
          <span class="field-hint" id="identifierHint"><span class="sage">A sound ISBN-13.</span> {formatIsbn(idCheck.isbn)}</span>
        {:else if idCheck.kind === 'isbn10'}
          <span class="field-hint" id="identifierHint">
            A sound ISBN-10. Most catalogs now file it as {formatIsbn(idCheck.as13)}.
            <button type="button" class="link-inline amber" onclick={() => bench.setMeta('identifier', idCheck.as13)}>Use ISBN-13</button>
          </span>
        {:else if idCheck.kind === 'bad-check'}
          <span class="field-error" id="identifierHint">
            The check digit should be {idCheck.expected}. A typo in an earlier digit gives the same result, so compare it with the book.
            <button type="button" class="link-inline" onclick={() => bench.setMeta('identifier', idCheck.corrected)}>Use {idCheck.corrected}</button>
          </span>
        {:else if idCheck.kind === 'not-isbn'}
          <span class="field-hint" id="identifierHint">Not an ISBN. Readers still use it to tell this edition apart.</span>
        {:else}
          <span class="field-hint" id="identifierHint">Type or scan the ISBN from the Catalog tab.</span>
        {/if}
      </label>
      <div class="field">
        <span class="t-field-label" id="dateLabel">Publication date{#if edited.has('date')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
        <DateField id="metaDate" value={meta.date} onchange={(v) => bench.setMeta('date', v)} />
      </div>
    </div>
    <div class="pair-grid">
      <label class="field">
        <span class="t-field-label">Publisher{#if edited.has('publisher')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
        <input class="input" id="metaPublisher" value={meta.publisher} oninput={(e) => bench.setMeta('publisher', e.currentTarget.value)} autocomplete="off" />
      </label>
      <label class="field">
        <span class="t-field-label">Language{#if edited.has('language')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
        <input class="input input-mono" id="metaLanguage" list="languages" value={meta.language} oninput={(e) => bench.setMeta('language', e.currentTarget.value.trim())} autocomplete="off" />
        <datalist id="languages">{#each LANGUAGES as l (l)}<option value={l}></option>{/each}</datalist>
      </label>
    </div>
    <div class="series-grid">
      <label class="field">
        <span class="t-field-label">Series{#if edited.has('series')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
        <input class="input" id="metaSeries" value={meta.series} oninput={(e) => bench.setMeta('series', e.currentTarget.value)} autocomplete="off" />
      </label>
      <label class="field">
        <span class="t-field-label">Number{#if edited.has('seriesIndex')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
        <input class="input input-mono" id="metaSeriesIndex" inputmode="decimal" value={meta.seriesIndex} oninput={(e) => bench.setMeta('seriesIndex', e.currentTarget.value)} autocomplete="off" />
      </label>
    </div>
    <div class="field">
      <label class="t-field-label" for="metaSubject">Subjects{#if edited.has('subjects')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</label>
      {#if meta.subjects.length}
        <div class="chip-row">
          {#each meta.subjects as s (s)}
            <span class="chip chip-tag">{s}<button type="button" class="chip-remove" aria-label="Remove {s}" onclick={() => bench.setMeta('subjects', meta.subjects.filter((x) => x !== s))}><Icon name="x" /></button></span>
          {/each}
        </div>
      {/if}
      <input
        class="input"
        id="metaSubject"
        placeholder="Add a subject and press Enter"
        bind:value={subject}
        enterkeyhint="done"
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addSubject();
          }
        }}
        onblur={addSubject}
      />
    </div>
    <label class="field">
      <span class="t-field-label">Synopsis{#if edited.has('description')}<span class="edited-mark" aria-hidden="true"></span><span class="visually-hidden">, edited</span>{/if}</span>
      <textarea class="textarea" id="metaDescription" rows="6" value={meta.description} oninput={(e) => bench.setMeta('description', e.currentTarget.value)}></textarea>
      <span class="field-hint tabular">
        {plural(synopsis, 'character')} · about {plural(meta.description.trim() ? meta.description.trim().split(/\s+/).length : 0, 'word')}.
        {synopsis >= SYNOPSIS_MIN ? 'Earns the synopsis marks.' : `${SYNOPSIS_MIN - synopsis} more to earn the synopsis marks.`}
      </span>
    </label>
  </div>
</section>
