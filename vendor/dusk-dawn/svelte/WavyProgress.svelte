<script lang="ts">
  // style.md §8.21. Shared by every Dusk & Dawn app through this package.
  // Material 3 Expressive's wavy progress bar: the filled part ripples while
  // the work goes on, and flattens into a plain line when it's done or when
  // reduced motion is set. Without a value it is indeterminate.
  import { prefersReducedMotion } from './expressive.js';

  interface Props {
    /** 0 to 1, or undefined while the amount of work is unknown. */
    value?: number;
    label: string;
    /** Wave height in px (default 3). 0 draws a flat bar. */
    amplitude?: number;
    /** One wave's length in px (default 24). */
    wavelength?: number;
  }

  let { value, label, amplitude = 3, wavelength = 24 }: Props = $props();
  const uid = $props.id();
  let width = $state(0);
  const reduced = prefersReducedMotion();

  // Indeterminate: the whole bar ripples, with no track.
  const fraction = $derived(value === undefined ? 1 : Math.max(0, Math.min(1, value)));
  const complete = $derived(value !== undefined && fraction >= 1);
  const amp = $derived(complete || reduced ? 0 : amplitude);
  const filled = $derived(Math.max(0, width * fraction - (fraction < 1 ? 4 : 0)));

  /** A sine wave from 0 to `to` px, one extra wavelength long so it can slide. */
  function wave(to: number, a: number): string {
    if (to <= 0) return 'M0 6';
    if (a === 0) return `M0 6 H${to.toFixed(1)}`;
    const parts = ['M0 6'];
    const half = wavelength / 2;
    for (let x = 0; x < to + wavelength; x += half) {
      const dir = Math.round(x / half) % 2 === 0 ? -1 : 1;
      parts.push(`Q${(x + half / 2).toFixed(1)} ${(6 + dir * a * 2).toFixed(1)} ${(x + half).toFixed(1)} 6`);
    }
    return parts.join(' ');
  }
</script>

<div
  class="wavy-progress-frame"
  bind:clientWidth={width}
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={value === undefined ? undefined : Math.round(fraction * 100)}
>
  <svg class="wavy-progress" class:is-complete={complete} viewBox="0 0 {Math.max(width, 1)} 12" aria-hidden="true">
    <defs>
      <clipPath id="{uid}-clip">
        <rect x="0" y="0" width={filled} height="12" />
      </clipPath>
    </defs>
    {#if value !== undefined && fraction < 1}
      <line
        class="wavy-progress-track"
        x1={Math.min(width, filled + 8)}
        y1="6"
        x2={width}
        y2="6"
        stroke-width="4"
        stroke-linecap="round"
      />
    {/if}
    <g clip-path="url(#{uid}-clip)">
      <path
        class="wavy-progress-wave"
        class:wavy-progress-moving={amp > 0}
        style:--wave-length="{wavelength}px"
        d={wave(filled, amp)}
        fill="none"
        stroke-width="4"
        stroke-linecap="round"
      />
    </g>
  </svg>
</div>
