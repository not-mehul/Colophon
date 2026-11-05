<script lang="ts">
  // New edition, in four steps: manuscript, chapters, imprint, cover. Binds
  // an EPUB 3 with nav, NCX and accessibility metadata, and opens it.
  import { buildEpub } from '../../epub/build';
  import { markdownToXhtml, splitManuscript, textToXhtml } from '../../epub/markdown';
  import { EMPTY_META, type Meta } from '../../epub/types';
  import { plural } from '../../lib/format';
  import { fileBytes, IMAGE_ACCEPT, pickFile } from '../../lib/pick';
  import { canvasJpeg, drawPlate, PLATE_STYLES, type PlateStyle } from '../../render/plate';
  import { cropCover, loadBitmap } from '../../render/image';
  import { imageMime } from '../../epub/image-size';
  import { bench } from '../../state/bench.svelte';
  import { settings } from '../../state/settings.svelte';
  import DateField from '../ui/DateField.svelte';
  import Icon from '../ui/Icon.svelte';
  import Sheet from '../ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const STEPS = ['Manuscript', 'Chapters', 'Imprint', 'Cover'] as const;
  let step = $state(0);
  let source = $state('');
  let chapters = $state<{ title: string; body: string; kind: 'md' | 'txt' }[]>([]);
  let meta = $state<Meta>({ ...EMPTY_META, subjects: [], date: String(new Date().getFullYear()) });
  let coverKind = $state<'plate' | 'image' | 'none'>('plate');
  let plate = $state<PlateStyle>(settings.value.defaultPlate);
  let image = $state.raw<{ bytes: Uint8Array; mediaType: string } | null>(null);
  let canvas = $state<HTMLCanvasElement>();
  let binding = $state(false);

  async function addFiles() {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.md,.markdown,.txt,text/plain,text/markdown', multiple: true });
    input.onchange = async () => {
      for (const file of input.files ?? []) {
        const text = await file.text();
        if (/\.txt$/i.test(file.name)) chapters.push({ title: file.name.replace(/\.txt$/i, '').replace(/[-_]+/g, ' '), body: text, kind: 'txt' });
        else chapters.push(...splitManuscript(text).map((c) => ({ ...c, kind: 'md' as const })));
      }
      if (chapters.length) step = 1;
    };
    input.click();
  }

  function split() {
    chapters = [...chapters, ...splitManuscript(source).map((c) => ({ ...c, kind: 'md' as const }))];
    source = '';
    step = 1;
  }

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= chapters.length) return;
    [chapters[i], chapters[j]] = [chapters[j]!, chapters[i]!];
  }

  $effect(() => {
    if (step === 3 && coverKind === 'plate' && canvas) drawPlate(canvas, plate, { title: meta.title, subtitle: meta.series, author: meta.creator });
  });

  async function chooseImage() {
    const file = await pickFile(IMAGE_ACCEPT);
    if (!file) return;
    const bytes = await fileBytes(file);
    const bitmap = await loadBitmap(bytes, file.type || imageMime(bytes));
    image = { bytes: await cropCover(bitmap, { zoom: 1, x: 0, y: 0 }), mediaType: 'image/jpeg' };
    bitmap.close();
  }

  const canNext = $derived(step === 0 ? chapters.length > 0 || !!source.trim() : step === 1 ? chapters.length > 0 : step === 2 ? !!meta.title.trim() && !!meta.creator.trim() : true);

  function next() {
    if (step === 0 && source.trim()) split();
    else step++;
  }

  async function bind() {
    binding = true;
    try {
      const cover = coverKind === 'plate' && canvas ? { bytes: await canvasJpeg(canvas), mediaType: 'image/jpeg' } : coverKind === 'image' ? image : null;
      const bytes = buildEpub({
        meta: $state.snapshot(meta) as Meta,
        chapters: chapters.map((c) => {
          const rest = c.body.replace(/^#{1,2}\s+.*(\n|$)/, '');
          return { title: c.title, body: c.kind === 'txt' ? textToXhtml(c.body, c.title) : markdownToXhtml(`# ${c.title}\n\n${rest}`) };
        }),
        cover,
      });
      const name = `${(meta.title || 'edition').replace(/[^\w\- ]+/g, '').trim() || 'edition'}.epub`;
      if (await bench.openBytes(bytes, name)) onclose();
    } finally {
      binding = false;
    }
  }
</script>

<Sheet title="New edition" {onclose} wide>
  <ol class="step-rail" aria-label="Steps">
    {#each STEPS as name, i (name)}
      <li class="step" class:done={i < step} class:current={i === step} aria-current={i === step ? 'step' : undefined}>
        <button type="button" disabled={i > step} onclick={() => (step = i)}>
          <span class="step-num tabular">{i < step ? '✓' : i + 1}</span><span class="step-name">{name}</span>
        </button>
      </li>
    {/each}
  </ol>

  {#if step === 0}
    <div class="form-stack">
      <p class="t-body-small">Paste a manuscript in Markdown, or add .md and .txt files. Each <span class="t-data-small"># Heading</span> starts a chapter.</p>
      <textarea class="textarea manuscript" rows="12" bind:value={source} placeholder="# Chapter One&#10;&#10;It was a bright cold day in April…" aria-label="Manuscript"></textarea>
      <div class="btn-row btn-row-start">
        <button type="button" class="btn btn-secondary" onclick={addFiles}><Icon name="file-plus" />Add files</button>
        {#if chapters.length}<span class="t-data-small dim">{plural(chapters.length, 'chapter')} so far</span>{/if}
      </div>
    </div>
  {:else if step === 1}
    <ol class="panel builder-chapters" aria-label="Chapters">
      {#each chapters as chapter, i (i)}
        <li class="builder-row">
          <span class="sig-index t-data-small tabular">{String(i + 1).padStart(2, '0')}</span>
          <input class="input" bind:value={chapter.title} aria-label="Chapter {i + 1} title" />
          <span class="t-data-small faint tabular">{(chapter.body.match(/\S+/g)?.length ?? 0).toLocaleString('en')} w</span>
          <button type="button" class="btn-icon" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="arrow-up" /></button>
          <button type="button" class="btn-icon" aria-label="Remove {chapter.title}" onclick={() => chapters.splice(i, 1)}><Icon name="x" /></button>
        </li>
      {/each}
    </ol>
    <button type="button" class="btn btn-muted" onclick={() => (step = 0)}><Icon name="plus" />Add more text</button>
  {:else if step === 2}
    <div class="form-stack">
      <label class="field"><span class="t-field-label">Title</span><input class="input" id="buildTitle" bind:value={meta.title} /></label>
      <label class="field"><span class="t-field-label">Author</span><input class="input" id="buildCreator" bind:value={meta.creator} /></label>
      <div class="pair-grid">
        <label class="field"><span class="t-field-label">Language</span><input class="input input-mono" bind:value={meta.language} /></label>
        <div class="field"><span class="t-field-label">Date</span><DateField value={meta.date} onchange={(v) => (meta.date = v)} /></div>
      </div>
      <div class="pair-grid">
        <label class="field"><span class="t-field-label">Publisher</span><input class="input" bind:value={meta.publisher} /></label>
        <label class="field"><span class="t-field-label">ISBN</span><input class="input input-mono" bind:value={meta.identifier} placeholder="Optional" /></label>
      </div>
      <label class="field"><span class="t-field-label">Synopsis</span><textarea class="textarea" rows="4" bind:value={meta.description}></textarea></label>
    </div>
  {:else}
    <div class="form-stack">
      <div class="segmented" role="radiogroup" aria-label="Cover">
        <button type="button" role="radio" aria-checked={coverKind === 'plate'} onclick={() => (coverKind = 'plate')}>Plate</button>
        <button type="button" role="radio" aria-checked={coverKind === 'image'} onclick={() => (coverKind = 'image')}>Image</button>
        <button type="button" role="radio" aria-checked={coverKind === 'none'} onclick={() => (coverKind = 'none')}>None</button>
      </div>
      {#if coverKind === 'plate'}
        <div class="chip-row">
          {#each PLATE_STYLES as s (s.id)}<button type="button" class="chip" aria-pressed={plate === s.id} onclick={() => (plate = s.id)}>{s.label}</button>{/each}
        </div>
        <canvas class="plate-canvas small" bind:this={canvas} width="1200" height="1800" aria-label="Cover preview"></canvas>
      {:else if coverKind === 'image'}
        <button type="button" class="btn btn-secondary" onclick={() => void chooseImage()}><Icon name="image-up" />{image ? 'Choose another' : 'Choose image'}</button>
        {#if image}<p class="t-data-small dim">Cropped to 1600 × 2400. Fine-tune it in Imprint afterwards.</p>{/if}
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={() => (step ? step-- : onclose())}>{step ? 'Back' : 'Cancel'}</button>
      {#if step < STEPS.length - 1}
        <button type="button" class="btn btn-primary" id="builderNext" disabled={!canNext} onclick={next}>Next</button>
      {:else}
        <button type="button" class="btn btn-primary" id="builderBind" disabled={binding || (coverKind === 'image' && !image)} onclick={() => void bind()}>{binding ? 'Binding…' : 'Bind edition'}</button>
      {/if}
    </div>
  {/snippet}
</Sheet>
