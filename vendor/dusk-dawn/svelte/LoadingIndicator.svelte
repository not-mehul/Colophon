<script lang="ts">
  // style.md §8.20. Shared by every Dusk & Dawn app through this package.
  // Material 3 Expressive's loading indicator: one shape that morphs through
  // the Expressive set while it turns. Use it for waits under a few seconds
  // where there's no progress to report; a long job with a known amount
  // gets WavyProgress. Holds still under reduced motion.
  import { LOADING_SHAPES, prefersReducedMotion, shapeClipPath } from './expressive.js';

  interface Props {
    /** What is loading, for screen readers: "Loading recipes". */
    label: string;
    /** Edge length in px (default 48). */
    size?: number;
    /** On a soft round container, for use over busy content. */
    contained?: boolean;
  }

  let { label, size = 48, contained = false }: Props = $props();
  let shape: HTMLSpanElement;

  $effect(() => {
    const frames = LOADING_SHAPES.map((name, i) => ({ clipPath: shapeClipPath(name, 48, i * 40) }));
    if (prefersReducedMotion()) {
      shape.style.clipPath = frames[0]?.clipPath ?? '';
      return;
    }
    const morph = shape.animate([...frames, frames[0] ?? {}], {
      duration: 650 * LOADING_SHAPES.length,
      iterations: Infinity,
      easing: 'linear',
    });
    return () => morph.cancel();
  });
</script>

<span
  class="loading-indicator"
  class:is-contained={contained}
  role="progressbar"
  aria-label={label}
  aria-busy="true"
  style:--size="{size}px"
>
  <span class="loading-indicator-shape" bind:this={shape}></span>
</span>
