<script lang="ts">
  // style.md §8.15: a 270° arc, open at the bottom, in the tier colour.
  import { tierOf } from '../../epub/audit';

  interface Props {
    score: number | null;
    size?: number;
    stroke?: number;
    labelled?: boolean;
    label?: string;
  }

  let { score, size = 88, stroke = 5.5, labelled = false, label }: Props = $props();

  const CIRC = 2 * Math.PI * 40;
  const ARC = CIRC * 0.75;
  const offset = $derived(score === null ? ARC : ARC - (Math.max(0, Math.min(100, score)) / 100) * ARC);
  const color = $derived(score === null ? 'var(--accent-amber)' : `var(${tierOf(score).cssVar})`);
</script>

<svg
  class="score-dial"
  width={size}
  height={size}
  viewBox="0 0 100 100"
  fill="none"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <circle cx="50" cy="50" r="40" style="stroke: var(--chart-track)" stroke-width={stroke} stroke-dasharray="{ARC} {CIRC}" stroke-linecap="round" transform="rotate(135 50 50)" />
  <circle
    cx="50"
    cy="50"
    r="40"
    style:stroke={color}
    stroke-width={stroke}
    stroke-dasharray="{ARC} {CIRC}"
    stroke-dashoffset={offset}
    stroke-linecap="round"
    transform="rotate(135 50 50)"
    class="arc"
  />
  {#if labelled && score !== null}
    <text x="50" y="58" text-anchor="middle" font-size="26" style:font-family="var(--font-serif)" style:fill="var(--text-heading)" class="tabular">{Math.round(score)}</text>
  {/if}
</svg>

<style>
  .score-dial {
    flex-shrink: 0;
  }
  .arc {
    transition:
      stroke-dashoffset var(--dur-settle) var(--ease-settle),
      stroke var(--dur-settle);
  }
</style>
