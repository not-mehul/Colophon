<script lang="ts">
  // The shape of the book: one bar per spine item in reading order, as tall
  // as the chapter is long. A stray split, a missing chapter or a notes file
  // in the wrong place shows at a glance, and the bars follow every move.
  // Tap a bar to preview that chapter. The list below offers the same, by
  // keyboard and screen reader, so the bars themselves are decorative.
  import { plural, readingMinutes, readingTime } from '../lib/format';
  import { bench } from '../state/bench.svelte';
  import { ui } from '../state/ui.svelte';

  const words = $derived(new Map((bench.edition?.chapters ?? []).map((c) => [c.id, c.words])));
  const bars = $derived(bench.draft.chapters.map((c) => ({ id: c.id, linear: c.linear, words: words.get(c.id) ?? 0, title: bench.titles.get(c.id) || 'Untitled' })));
  const max = $derived(Math.max(1, ...bars.map((b) => b.words)));
  const flow = $derived(bars.filter((b) => b.linear));
  const total = $derived(flow.reduce((sum, b) => sum + b.words, 0));
  const longest = $derived(flow.reduce<(typeof bars)[number] | null>((best, b) => (!best || b.words > best.words ? b : best), null));
  /** Chapters in the main flow far shorter than the typical one: often a split that went wrong. */
  const slight = $derived.by(() => {
    const sorted = flow.map((b) => b.words).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    return flow.length >= 4 ? flow.filter((b) => b.words < Math.min(60, median * 0.05)).length : 0;
  });

  function preview(id: string) {
    ui.previewChapter = id;
    ui.open('preview');
  }
</script>

{#if bars.length > 1}
  <figure class="shape" aria-label="The shape of the book: {plural(bars.length, 'spine item')}, {total.toLocaleString('en')} words in the main flow.">
    <div class="shape-bars" aria-hidden="true">
      {#each bars as bar (bar.id)}
        <button
          type="button"
          tabindex="-1"
          class="shape-bar"
          class:aux={!bar.linear}
          class:longest={bar.id === longest?.id}
          aria-label="Preview {bar.title}"
          onclick={() => preview(bar.id)}
        >
          <span style:height="{Math.max(3, (bar.words / max) * 100)}%"></span>
        </button>
      {/each}
    </div>
    <figcaption class="t-data-small dim shape-caption">
      <span class="tabular">{total.toLocaleString('en')} words</span>
      {#if total}<span>· about {readingTime(readingMinutes(total))} to read</span>{/if}
      {#if longest && flow.length > 2}<span class="ellipsis">· longest: {longest.title}</span>{/if}
      {#if slight}<span class="amber">· {plural(slight, 'very short chapter')}</span>{/if}
    </figcaption>
  </figure>
{/if}
