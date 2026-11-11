<script lang="ts">
  // The inspection as a 1080 × 1350 card to share.
  import { plural } from '../../lib/format';
  import { shareFile } from '../../platform/output';
  import { shown } from '../../platform/theme.svelte';
  import { renderReportCard } from '../../render/report-card';
  import { bench } from '../../state/bench.svelte';
  import { ui } from '../../state/ui.svelte';
  import Icon from '../ui/Icon.svelte';
  import Sheet from '../ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let blob = $state.raw<Blob | null>(null);
  let url = $state('');

  $effect(() => {
    void shown.dark;
    const edition = bench.edition!;
    const cover = bench.cover;
    let live = true;
    void renderReportCard({
      title: bench.draft.meta.title || 'Untitled edition',
      creator: bench.draft.meta.creator,
      facts: `EPUB ${edition.version} · ${plural(edition.chapters.length, 'chapter')} · ${plural(edition.totalWords, 'word')}`,
      audit: bench.audit,
      cover: cover ? { bytes: cover.bytes, mediaType: cover.mediaType } : null,
      date: new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' }),
    }).then((b) => {
      if (!live) return;
      blob = b;
      url = URL.createObjectURL(b);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  });

  async function share() {
    if (!blob) return;
    const name = bench.exportName.replace(/\.epub$/i, ' - report.png');
    try {
      await shareFile({ name, data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png' }, `${bench.draft.meta.title} report`);
    } catch (err) {
      ui.notify(`Couldn't share the card (${err instanceof Error ? err.message : String(err)}).`, 'error');
    }
  }
</script>

<Sheet title="Report card" {onclose}>
  <div class="report-frame">
    {#if url}<img src={url} alt="Report card: score {bench.audit.score} of 100" />{:else}<p class="empty-match">Drawing…</p>{/if}
  </div>
  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="shareCard" disabled={!blob} onclick={() => void share()}><Icon name="share-2" />Share</button>
    </div>
  {/snippet}
</Sheet>
