<script lang="ts">
  // A chapter as a reader would see it, in a sandboxed frame (no scripts).
  import { chapterPage } from '../../epub/preview';
  import { shown } from '../../platform/theme.svelte';
  import { bench } from '../../state/bench.svelte';
  import { ui } from '../../state/ui.svelte';
  import Icon from '../ui/Icon.svelte';
  import Sheet from '../ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const chapters = $derived(bench.draft.chapters);
  const index = $derived(Math.max(0, chapters.findIndex((c) => c.id === ui.previewChapter)));
  const chapter = $derived(chapters[index]);

  const page = $derived.by(() => {
    void shown.dark;
    if (!bench.edition || !chapter) return '';
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    return chapterPage(bench.edition, bench.draft, chapter.path, {
      text: token('--text-body'),
      background: token('--bg-grad-mid'),
      accent: token('--accent-amber'),
      serif: token('--font-serif') || 'serif',
    });
  });

  const go = (by: number) => (ui.previewChapter = chapters[index + by]?.id ?? ui.previewChapter);
</script>

<Sheet title={bench.titles.get(chapter?.id ?? '') || 'Chapter'} {onclose} wide>
  <iframe class="preview-frame" title="Chapter preview" sandbox="" srcdoc={page}></iframe>
  {#snippet footer()}
    <div class="btn-row preview-nav">
      <button type="button" class="btn btn-muted" disabled={index === 0} onclick={() => go(-1)}><Icon name="chevron-left" />Previous</button>
      <span class="t-data-small dim tabular">{index + 1} of {chapters.length}</span>
      <button type="button" class="btn btn-muted" disabled={index >= chapters.length - 1} onclick={() => go(1)}>Next<Icon name="chevron-right" /></button>
    </div>
  {/snippet}
</Sheet>
