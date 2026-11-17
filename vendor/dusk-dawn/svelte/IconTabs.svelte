<script lang="ts" generics="V extends string">
  // style.md §8.5.1. The tab rail with an icon over each word, the tabs
  // sharing the width evenly so none is pushed off the edge, even with the
  // phone's text size turned up. Same keyboard, ARIA and rule as TabRail.
  // The app passes each icon as a snippet, drawn in its own Lucide set.
  // labels="selected" (§8.5.2) is the compact form: icons in a row, and only
  // the selected tab opens to show its word beside the icon.
  import { tick, type Snippet } from 'svelte';

  interface Tab {
    id: V;
    label: string;
    /** The tab's icon, about 22px, stroked in currentColor. */
    icon: Snippet;
    /** A count on the icon's corner. */
    badge?: number;
    /** The tab button's DOM id, for tests and aria-labelledby. */
    domId?: string;
    /** The panel the tab controls. */
    controls?: string;
  }

  interface Props {
    tabs: readonly Tab[];
    value: V;
    label: string;
    onselect: (id: V) => void;
    /** 'always' (default): every tab shows its word under the icon.
     *  'selected': compact, icon only, the selected tab opening to its word. */
    labels?: 'always' | 'selected';
  }

  let { tabs, value, label, onselect, labels = 'always' }: Props = $props();
  const compact = $derived(labels === 'selected');
  let rail: HTMLDivElement;
  const hasValue = $derived(tabs.some((t) => t.id === value));
  let ruleX = $state(0);
  let ruleWidth = $state(0);
  /** Compact form: whether the selected word fits whole beside its icon. */
  let wordFits = $state(true);

  /** The room the selected tab has for its word, once every other tab has its icon. */
  function roomForWord(active: HTMLElement): number {
    const style = getComputedStyle(rail);
    const gap = parseFloat(style.columnGap) || 0;
    const all = [...rail.querySelectorAll<HTMLElement>('[role="tab"]')];
    const others = all.filter((t) => t !== active).reduce((sum, t) => sum + t.offsetWidth, 0);
    const glyph = active.querySelector<HTMLElement>('.icon-tab-glyph');
    const pad = parseFloat(getComputedStyle(active).paddingLeft) + parseFloat(getComputedStyle(active).paddingRight);
    return rail.clientWidth - others - gap * (all.length - 1) - (glyph?.offsetWidth ?? 0) - pad;
  }

  function place() {
    const active = rail?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) {
      ruleWidth = 0;
      return;
    }
    if (compact) {
      // The word opens only if it fits whole; a clipped word would read as a
      // mistake, so a tight rail keeps to the amber icon and its rule.
      const word = active.querySelector<HTMLElement>('.icon-tab-word');
      // scrollWidth is the whole word and its padding, even while it is clipped.
      if (word) wordFits = word.scrollWidth <= roomForWord(active) + 0.5;
      // Under the icon and its word, as the word opens.
      const inner = active.querySelector<HTMLElement>('.icon-tab-inner') ?? active;
      ruleX = inner.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
      ruleWidth = inner.offsetWidth;
      return;
    }
    // A short rule centred under the icon, not the whole share of the width.
    const width = Math.min(active.offsetWidth, 56);
    ruleX = active.offsetLeft + (active.offsetWidth - width) / 2;
    ruleWidth = width;
  }

  $effect(() => {
    void value;
    void tabs;
    void tick().then(place);
  });

  $effect(() => {
    void tabs.length;
    // The rail, and each tab: in the compact form a tab changes width as its
    // word opens, and the rule follows it frame by frame.
    const observer = new ResizeObserver(() => place());
    observer.observe(rail);
    for (const tab of rail.querySelectorAll('[role="tab"]')) observer.observe(tab);
    return () => observer.disconnect();
  });

  function onkeydown(event: KeyboardEvent) {
    const i = Math.max(
      0,
      tabs.findIndex((t) => t.id === value)
    );
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const tab = tabs[(i + step + tabs.length) % tabs.length];
    if (!tab) return;
    onselect(tab.id);
    void tick().then(() => rail.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  }
</script>

<div
  class="icon-tabs"
  class:icon-tabs-compact={compact}
  class:is-tight={compact && !wordFits}
  role="tablist"
  aria-label={label}
  tabindex="-1"
  bind:this={rail}
  style:--rule-x="{ruleX}px"
  style:--rule-width="{ruleWidth}px"
  style:--rule-opacity={hasValue ? 1 : 0}
  {onkeydown}
>
  {#each tabs as tab, i (tab.id)}
    <button
      type="button"
      role="tab"
      id={tab.domId}
      aria-controls={tab.controls}
      aria-selected={tab.id === value}
      aria-label={tab.badge ? `${tab.label}, ${tab.badge}` : tab.label}
      tabindex={tab.id === value || (!hasValue && i === 0) ? 0 : -1}
      onclick={() => onselect(tab.id)}
    >
      {#if compact}
        <span class="icon-tab-inner">
          <span class="icon-tab-glyph">
            {@render tab.icon()}
            {#if tab.badge}<span class="badge">{tab.badge > 99 ? '99+' : tab.badge}</span>{/if}
          </span>
          <span class="icon-tab-reveal"><span class="icon-tab-word">{tab.label}</span></span>
        </span>
      {:else}
        <span class="icon-tab-glyph">
          {@render tab.icon()}
          {#if tab.badge}<span class="badge">{tab.badge > 99 ? '99+' : tab.badge}</span>{/if}
        </span>
        <span class="icon-tab-word">{tab.label}</span>
      {/if}
    </button>
  {/each}
  <span class="tab-rule" aria-hidden="true"></span>
</div>
