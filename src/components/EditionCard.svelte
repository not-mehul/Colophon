<script lang="ts">
  // One edition on the library bench: cover, title, author, score.
  // A tap opens it; a long press starts selecting (style.md §14).
  import { tierOf } from '../epub/audit';
  import { fileSize, relativeDay } from '../lib/format';
  import { select } from '../platform/haptics';
  import type { StoredEdition } from '../state/db';
  import BlobImg from './ui/BlobImg.svelte';
  import Icon from './ui/Icon.svelte';
  import ScoreDial from './ui/ScoreDial.svelte';

  interface Props {
    edition: StoredEdition;
    selecting: boolean;
    selected: boolean;
    onopen: () => void;
    ontoggle: () => void;
  }

  let { edition, selecting, selected, onopen, ontoggle }: Props = $props();
  const LONG_PRESS_MS = 450;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pressed = false;
  let origin = { x: 0, y: 0 };
  const tier = $derived(tierOf(edition.score));

  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    pressed = false;
    origin = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      pressed = true;
      select();
      ontoggle();
    }, LONG_PRESS_MS);
  }
  function move(e: PointerEvent) {
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 10) clearTimeout(timer);
  }
  function up() {
    clearTimeout(timer);
  }
  function click(e: MouseEvent) {
    if (pressed) {
      pressed = false;
      e.preventDefault();
      return;
    }
    if (selecting) ontoggle();
    else onopen();
  }
</script>

<button
  type="button"
  class="edition-card"
  class:selected
  aria-pressed={selecting ? selected : undefined}
  aria-label="{edition.title || edition.fileName}{edition.creator ? `, ${edition.creator}` : ''}. Score {edition.score}, {tier.name}."
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onpointerleave={up}
  oncontextmenu={(e) => {
    e.preventDefault();
    if (!selecting) ontoggle();
  }}
  onclick={click}
>
  <span class="edition-thumb" aria-hidden="true">
    {#if edition.thumb}<BlobImg bytes={edition.thumb} alt="" />{:else}<Icon name="book-dashed" />{/if}
    {#if selecting}<span class="edition-check" class:on={selected}><Icon name="check" /></span>{/if}
  </span>
  <span class="edition-text">
    <span class="t-card-title edition-title">{edition.title || 'Untitled edition'}</span>
    <span class="edition-author">{edition.creator || 'Unknown author'}</span>
    <span class="t-data-small edition-meta">
      {fileSize(edition.size)} · {edition.boundAt ? `bound ${relativeDay(edition.boundAt)}` : `opened ${relativeDay(edition.openedAt)}`}{#if edition.draft}
        · <span class="amber">unsaved edits</span>{/if}
    </span>
  </span>
  <span class="edition-score" style:color="var({tier.cssVar})">
    <ScoreDial score={edition.score} size={48} stroke={7} />
    <span class="edition-score-num tabular">{edition.score}</span>
  </span>
</button>
