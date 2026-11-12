<script lang="ts">
  // The reading order: drag a row by its grip to move it (a tap of haptics
  // when it lands), or use the arrow keys on the grip. Tap a file name to rename.
  import { tick } from 'svelte';
  import { tap, select } from '../platform/haptics';
  import { bench } from '../state/bench.svelte';
  import { ui } from '../state/ui.svelte';
  import Icon from './ui/Icon.svelte';

  let list: HTMLOListElement;
  let dragging = $state<number | null>(null);
  let over = $state<number | null>(null);
  let offset = $state(0);
  let startY = 0;
  let rowTops: number[] = [];
  let editing = $state<number | null>(null);

  const chapters = $derived(bench.draft.chapters);
  /** Where each chapter sat in the file as opened, to show on rows that have moved. */
  const opened = $derived(new Map((bench.edition?.chapters ?? []).map((c, i) => [c.id, i])));
  const words = $derived(new Map((bench.edition?.chapters ?? []).map((c) => [c.id, c.words])));

  function begin(e: PointerEvent, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    rowTops = [...list.children].map((el) => (el as HTMLElement).getBoundingClientRect().top + (el as HTMLElement).offsetHeight / 2);
    startY = e.clientY;
    dragging = index;
    over = index;
    ui.dragChapter = chapters[index]?.id ?? null;
    offset = 0;
    select();
  }

  function move(e: PointerEvent) {
    if (dragging === null) return;
    offset = e.clientY - startY;
    const y = rowTops[dragging]! + offset;
    let target = rowTops.findIndex((mid) => y < mid);
    if (target === -1) target = rowTops.length - 1;
    else if (target > dragging) target -= 1;
    if (target !== over) {
      over = target;
      select();
    }
  }

  function end() {
    if (dragging === null) return;
    const from = dragging;
    const to = over ?? from;
    dragging = null;
    over = null;
    offset = 0;
    ui.dragChapter = null;
    if (from !== to) {
      bench.moveChapter(from, to);
      tap();
    }
  }

  async function key(e: KeyboardEvent, index: number) {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= chapters.length) return;
    e.preventDefault();
    bench.moveChapter(index, to);
    await tick();
    list.querySelectorAll<HTMLElement>('.sig-grip')[to]?.focus();
  }

  /** Where the row sits while another is dragged past it. */
  function shift(index: number): string | undefined {
    if (dragging === null || over === null || index === dragging) return undefined;
    const h = (list.children[dragging] as HTMLElement | undefined)?.offsetHeight ?? 0;
    if (dragging < index && index <= over) return `translateY(${-h}px)`;
    if (over <= index && index < dragging) return `translateY(${h}px)`;
    return 'translateY(0)';
  }

  /** The number a row will carry if the drag ends now, so the new order reads while you move. */
  function position(index: number): number {
    if (dragging === null || over === null) return index;
    if (index === dragging) return over;
    if (dragging < index && index <= over) return index - 1;
    if (over <= index && index < dragging) return index + 1;
    return index;
  }

  function preview(id: string) {
    ui.previewChapter = id;
    ui.open('preview');
  }
</script>

<ol class="panel sig-list" class:is-dragging={dragging !== null} bind:this={list} aria-label="Reading order">
  {#each chapters as chapter, i (chapter.id)}
    {@const renamed = chapter.fileName !== chapter.path.slice(chapter.path.lastIndexOf('/') + 1)}
    {@const was = opened.get(chapter.id) ?? i}
    {@const at = position(i)}
    <li
      class="sig-row"
      class:lifted={dragging === i}
      class:aux={!chapter.linear}
      style:transform={dragging === i ? `translateY(${offset}px)` : shift(i)}
    >
      <button
        type="button"
        class="sig-grip"
        aria-label="Move {bench.titles.get(chapter.id)}, position {i + 1} of {chapters.length}. Arrow keys move it."
        onpointerdown={(e) => begin(e, i)}
        onpointermove={move}
        onpointerup={end}
        onpointercancel={end}
        onkeydown={(e) => void key(e, i)}
      >
        <Icon name="grip-vertical" />
      </button>
      <span class="sig-index t-data-small tabular" class:shifting={at !== i}>
        {String(at + 1).padStart(2, '0')}
        {#if was !== i && dragging === null}<span class="sig-was"><span class="visually-hidden">was </span>{String(was + 1).padStart(2, '0')}</span>{/if}
      </span>
      <div class="sig-main">
        <p class="sig-title"><span class="ellipsis">{bench.titles.get(chapter.id) || 'Untitled'}</span>{#if !chapter.linear}<span class="chip-status">Outside the flow</span>{/if}</p>
        {#if editing === i}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="input input-mono sig-rename"
            value={chapter.fileName}
            aria-label="File name"
            autofocus
            onkeydown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') editing = null;
            }}
            onblur={(e) => {
              if (editing === i) bench.renameChapter(i, e.currentTarget.value);
              editing = null;
            }}
          />
        {:else}
          <button type="button" class="sig-file t-data-small ellipsis" class:amber={renamed} onclick={() => (editing = i)} aria-label="Rename {chapter.fileName}">
            {chapter.fileName}
          </button>
        {/if}
      </div>
      <span class="t-data-small faint tabular sig-words">{(words.get(chapter.id) ?? 0).toLocaleString('en')} w</span>
      <button type="button" class="btn-icon" aria-label="Preview {bench.titles.get(chapter.id)}" onclick={() => preview(chapter.id)}><Icon name="eye" /></button>
    </li>
  {/each}
</ol>
