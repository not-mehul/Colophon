<script lang="ts">
  // Imprint: the cover and the Dublin Core fields. Every field writes to the
  // draft as it's typed; Reset puts the original back, with Undo.
  import { imageMime } from '../epub/image-size';
  import { IMAGE_ACCEPT, fileBytes, pickFile } from '../lib/pick';
  import { bench } from '../state/bench.svelte';
  import { ui } from '../state/ui.svelte';
  import BlobImg from './ui/BlobImg.svelte';
  import DateField from './ui/DateField.svelte';
  import Icon from './ui/Icon.svelte';

  const meta = $derived(bench.draft.meta);
  const cover = $derived(bench.cover);
  let subject = $state('');

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
      <span class="t-field-label">Title</span>
      <input class="input" id="metaTitle" value={meta.title} oninput={(e) => bench.setMeta('title', e.currentTarget.value)} autocomplete="off" />
    </label>
    <label class="field">
      <span class="t-field-label">Author</span>
      <input class="input" id="metaCreator" value={meta.creator} oninput={(e) => bench.setMeta('creator', e.currentTarget.value)} autocomplete="off" />
      <span class="field-hint">Separate several authors with commas.</span>
    </label>
    <div class="pair-grid">
      <label class="field">
        <span class="t-field-label">ISBN or identifier</span>
        <input class="input input-mono" id="metaIdentifier" value={meta.identifier} inputmode="text" oninput={(e) => bench.setMeta('identifier', e.currentTarget.value)} autocomplete="off" />
      </label>
      <div class="field">
        <span class="t-field-label" id="dateLabel">Publication date</span>
        <DateField id="metaDate" value={meta.date} onchange={(v) => bench.setMeta('date', v)} />
      </div>
    </div>
    <div class="pair-grid">
      <label class="field">
        <span class="t-field-label">Publisher</span>
        <input class="input" id="metaPublisher" value={meta.publisher} oninput={(e) => bench.setMeta('publisher', e.currentTarget.value)} autocomplete="off" />
      </label>
      <label class="field">
        <span class="t-field-label">Language</span>
        <input class="input input-mono" id="metaLanguage" list="languages" value={meta.language} oninput={(e) => bench.setMeta('language', e.currentTarget.value.trim())} autocomplete="off" />
        <datalist id="languages">{#each LANGUAGES as l (l)}<option value={l}></option>{/each}</datalist>
      </label>
    </div>
    <div class="series-grid">
      <label class="field">
        <span class="t-field-label">Series</span>
        <input class="input" id="metaSeries" value={meta.series} oninput={(e) => bench.setMeta('series', e.currentTarget.value)} autocomplete="off" />
      </label>
      <label class="field">
        <span class="t-field-label">Number</span>
        <input class="input input-mono" id="metaSeriesIndex" inputmode="decimal" value={meta.seriesIndex} oninput={(e) => bench.setMeta('seriesIndex', e.currentTarget.value)} autocomplete="off" />
      </label>
    </div>
    <div class="field">
      <label class="t-field-label" for="metaSubject">Subjects</label>
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
      <span class="t-field-label">Synopsis</span>
      <textarea class="textarea" id="metaDescription" rows="6" value={meta.description} oninput={(e) => bench.setMeta('description', e.currentTarget.value)}></textarea>
      <span class="field-hint tabular">{meta.description.trim().length.toLocaleString('en')} characters; 80 or more earns full marks.</span>
    </label>
  </div>
</section>
