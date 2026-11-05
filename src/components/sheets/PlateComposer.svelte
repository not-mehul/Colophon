<script lang="ts">
  // Compose a typographic plate: four styles, three lines of type. Noir can
  // take its glow from the current cover; E-ink is drawn in greys.
  import { canvasJpeg, coverTint, drawPlate, PLATE_STYLES, type PlateStyle } from '../../render/plate';
  import { bench } from '../../state/bench.svelte';
  import { settings } from '../../state/settings.svelte';
  import { shown } from '../../platform/theme.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Switch from '../ui/Switch.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const meta = bench.draft.meta;
  let style = $state<PlateStyle>(settings.value.defaultPlate);
  let title = $state(meta.title);
  let subtitle = $state(meta.series ? `${meta.series}${meta.seriesIndex ? ` · ${meta.seriesIndex}` : ''}` : '');
  let author = $state(meta.creator);
  let fromCover = $state(!!bench.cover);
  let tint = $state<string | null>(null);
  let canvas: HTMLCanvasElement;
  let saving = $state(false);

  $effect(() => {
    const cover = bench.cover;
    void coverTint(cover?.bytes ?? null, cover?.mediaType ?? 'image/jpeg').then((t) => (tint = t));
  });

  $effect(() => {
    void shown.dark;
    void document.fonts?.ready.then(() => undefined);
    drawPlate(canvas, style, { title, subtitle, author }, fromCover && style === 'noir' ? tint : null);
  });

  async function use() {
    saving = true;
    try {
      await bench.setCover(await canvasJpeg(canvas), 'image/jpeg');
      void settings.update({ defaultPlate: style });
      onclose();
    } finally {
      saving = false;
    }
  }
</script>

<Sheet title="Compose a plate" {onclose} wide>
  <div class="plate-layout">
    <canvas class="plate-canvas" bind:this={canvas} width="1200" height="1800" aria-label="Plate preview"></canvas>
    <div class="form-stack">
      <div class="segmented" role="radiogroup" aria-label="Style">
        {#each PLATE_STYLES as s (s.id)}<button type="button" role="radio" aria-checked={style === s.id} onclick={() => (style = s.id)}>{s.label}</button>{/each}
      </div>
      {#if style === 'noir'}
        <Switch checked={fromCover} label="Glow from the cover" hint={tint ? 'Takes its colour from the current cover.' : 'There is no cover to take a colour from.'} onchange={(v) => (fromCover = v)} />
      {:else if style === 'eink'}
        <p class="field-hint">Drawn in greys, so it looks the same on an e-reader.</p>
      {/if}
      <label class="field"><span class="t-field-label">Line above</span><input class="input" bind:value={subtitle} placeholder="A series, or an imprint" /></label>
      <label class="field"><span class="t-field-label">Title</span><input class="input" bind:value={title} /></label>
      <label class="field"><span class="t-field-label">Author</span><input class="input" bind:value={author} /></label>
    </div>
  </div>
  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={onclose}>Cancel</button>
      <button type="button" class="btn btn-primary" id="usePlate" disabled={saving} onclick={() => void use()}>Use as cover</button>
    </div>
  {/snippet}
</Sheet>
