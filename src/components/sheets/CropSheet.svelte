<script lang="ts">
  // Crop and resize a cover to 1600 × 2400 (2:3): drag to move, slide or
  // pinch to zoom. The preview and the output share `placement`.
  import { imageSize } from '../../epub/image-size';
  import { COVER_H, COVER_W, cropCover, loadBitmap, placement, type Crop } from '../../render/image';
  import { bench } from '../../state/bench.svelte';
  import { ui } from '../../state/ui.svelte';
  import Sheet from '../ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const source = ui.cropImage;
  let bitmap = $state.raw<ImageBitmap | null>(null);
  let crop = $state<Crop>({ zoom: 1, x: 0, y: 0 });
  let frame: HTMLDivElement;
  let frameW = $state(240);
  let saving = $state(false);
  let failed = $state(false);
  const frameH = $derived(frameW * 1.5);
  const size = source ? imageSize(source.bytes) : { width: 0, height: 0 };
  const url = source ? URL.createObjectURL(new Blob([source.bytes as Uint8Array<ArrayBuffer>], { type: source.mediaType })) : '';
  const place = $derived(bitmap ? placement(bitmap.width, bitmap.height, frameW, frameH, crop) : null);
  const upscaled = $derived(bitmap ? Math.max(COVER_W / bitmap.width, COVER_H / bitmap.height) * crop.zoom > 1.05 : false);

  $effect(() => {
    if (source) {
      loadBitmap(source.bytes, source.mediaType).then(
        (b) => (bitmap = b),
        () => (failed = true),
      );
    }
    const observer = new ResizeObserver(() => (frameW = frame.clientWidth));
    observer.observe(frame);
    return () => {
      observer.disconnect();
      URL.revokeObjectURL(url);
      bitmap?.close();
    };
  });

  // Dragging and pinching on the frame.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- pointer bookkeeping, never rendered
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchFrom = 0;
  let zoomFrom = 1;
  function down(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchFrom = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      zoomFrom = crop.zoom;
    }
  }
  function move(e: PointerEvent) {
    const last = pointers.get(e.pointerId);
    if (!last || !place) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      crop.zoom = Math.max(1, Math.min(4, (zoomFrom * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / (pinchFrom || 1)));
      return;
    }
    const nx = crop.x + (e.clientX - last.x) / frameW;
    const ny = crop.y + (e.clientY - last.y) / frameH;
    crop.x = Math.max(-place.maxX / frameW, Math.min(place.maxX / frameW, nx));
    crop.y = Math.max(-place.maxY / frameH, Math.min(place.maxY / frameH, ny));
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
  }

  async function use() {
    if (!bitmap) return;
    saving = true;
    try {
      await bench.setCover(await cropCover(bitmap, $state.snapshot(crop)), 'image/jpeg');
      onclose();
    } catch (err) {
      ui.notify(`Couldn't crop the image (${err instanceof Error ? err.message : String(err)}).`, 'error');
    } finally {
      saving = false;
    }
  }
</script>

<Sheet title="Crop the cover" {onclose}>
  <div class="crop-layout">
    <div class="crop-frame" bind:this={frame} style:height="{frameH}px" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
      {#if place}
        <img src={url} alt="" draggable="false" style:width="{place.w}px" style:height="{place.h}px" style:left="{place.left}px" style:top="{place.top}px" />
      {:else if failed}
        <p class="empty-match">That image won't open. Try a JPEG or PNG.</p>
      {/if}
      <span class="crop-thirds" aria-hidden="true"></span>
    </div>
    <div class="crop-side form-stack">
      <label class="field">
        <span class="t-field-label">Zoom</span>
        <input type="range" class="range" min="1" max="4" step="0.01" bind:value={crop.zoom} aria-valuetext="{Math.round(crop.zoom * 100)}%" />
      </label>
      <p class="t-data-small dim tabular">From {size.width} × {size.height} px to {COVER_W} × {COVER_H} px, JPEG.</p>
      {#if upscaled}<p class="field-hint">The image is smaller than the output, so it will be enlarged and look soft.</p>{/if}
      <button type="button" class="btn btn-muted" onclick={() => (crop = { zoom: 1, x: 0, y: 0 })}>Centre</button>
    </div>
  </div>
  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={onclose}>Cancel</button>
      <button type="button" class="btn btn-primary" id="useCrop" disabled={!bitmap || saving} onclick={() => void use()}>{saving ? 'Cropping…' : 'Use as cover'}</button>
    </div>
  {/snippet}
</Sheet>
