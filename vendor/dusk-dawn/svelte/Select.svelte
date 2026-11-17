<script lang="ts" module>
  /** One choice in a Select. Options that share a `group` sit under its heading. */
  export interface SelectOption<T extends string | number = string> {
    value: T;
    label: string;
    group?: string;
    disabled?: boolean;
  }

  let count = 0;
</script>

<script lang="ts" generics="T extends string | number">
  // style.md §8.6.1. A themed replacement for <select>: a field shaped like an
  // input that opens a menu of options under it (or over it, near the bottom
  // of the screen), so Android never shows its own picker. It follows the
  // WAI-ARIA select-only combobox pattern: focus stays on the field and the
  // arrow keys move through the options; Enter, Space or a tap chooses one;
  // Escape, a tap outside or Android back (through dismissOverlay) closes it
  // unchanged. The menu sits in the top layer, so modals and sheets never
  // clip it.
  import { onDestroy, tick } from 'svelte';
  import { prefersReducedMotion, spring } from './expressive.js';
  import { dismissOverlay, pushOverlay } from './overlay.js';

  interface Props {
    value: T;
    options: readonly SelectOption<T>[];
    /** Called with the new value when the reader chooses a different option. */
    onchange?: (value: T) => void;
    /** The field's DOM id, so a <label for> names it. */
    id?: string;
    /** The accessible name, when there is no visible label. */
    label?: string;
    labelledby?: string;
    describedby?: string;
    /** Shown when the value matches no option. */
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    /** Extra classes for the field, such as an app's compact size. */
    class?: string;
  }

  let {
    value = $bindable(),
    options,
    onchange,
    id,
    label,
    labelledby,
    describedby,
    placeholder = '',
    disabled = false,
    invalid = false,
    class: className = '',
  }: Props = $props();

  const uid = `dd-select-${++count}`;
  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement | null>(null);
  let open = $state(false);
  let active = $state(-1);
  let above = $state(false);
  let listName = $state('');
  let release: (() => void) | null = null;

  const selectedIndex = $derived(options.findIndex((o) => o.value === value));
  const shown = $derived(selectedIndex >= 0 ? options[selectedIndex]?.label : undefined);

  /** Options in runs that share a group, keeping their indexes. */
  const sections = $derived.by(() => {
    const out: { group?: string; items: { option: SelectOption<T>; index: number }[] }[] = [];
    options.forEach((option, index) => {
      const last = out[out.length - 1];
      if (last && last.group === option.group) last.items.push({ option, index });
      else out.push({ group: option.group, items: [{ option, index }] });
    });
    return out;
  });

  const enabled = (i: number) => i >= 0 && i < options.length && !options[i]?.disabled;

  function step(from: number, by: number): number {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i += by;
      if (i < 0 || i >= options.length) return from;
      if (enabled(i)) return i;
    }
    return from;
  }
  const first = () => step(-1, 1);
  const last = () => step(options.length, -1);

  /** The visible label's words, without the field inside it. */
  function nameFromLabel(): string {
    const el = trigger.labels?.[0];
    if (!el) return '';
    let text = '';
    for (const node of el.childNodes) {
      if (node instanceof Element && node.contains(trigger)) continue;
      text += node.textContent ?? '';
    }
    return text.trim();
  }

  function place() {
    if (!menu || !trigger) return;
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    if (r.bottom < 0 || r.top > vh) {
      hide();
      return;
    }
    const gap = 4;
    const edge = 8;
    menu.style.minWidth = `${Math.min(r.width, vw - 2 * edge)}px`;
    menu.style.maxWidth = `${vw - 2 * edge}px`;
    menu.style.maxHeight = 'none';
    const natural = menu.scrollHeight + 2;
    const below = vh - r.bottom - gap - edge;
    const over = r.top - gap - edge;
    above = natural > below && over > below;
    const room = Math.max(above ? over : below, 120);
    menu.style.maxHeight = `${room}px`;
    const h = Math.min(natural, room);
    const w = menu.offsetWidth;
    // Line up with the field's left edge, or its right edge when the menu is
    // wider than the room to the right of it.
    let left = r.left;
    if (left + w > vw - edge) left = Math.max(edge, Math.min(r.right, vw - edge) - w);
    menu.style.left = `${left}px`;
    menu.style.top = `${above ? r.top - gap - h : r.bottom + gap}px`;
  }

  function reveal(i: number) {
    if (!menu || i < 0) return;
    const el = menu.querySelector<HTMLElement>(`#${optionId(i)}`);
    if (!el) return;
    const pad = 4;
    if (el.offsetTop < menu.scrollTop + pad) menu.scrollTop = el.offsetTop - pad;
    else if (el.offsetTop + el.offsetHeight > menu.scrollTop + menu.clientHeight - pad)
      menu.scrollTop = el.offsetTop + el.offsetHeight - menu.clientHeight + pad;
  }

  function onScroll(e: Event) {
    if (menu && e.target instanceof Node && menu.contains(e.target)) return;
    place();
  }

  function onPointerDown(e: Event) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (trigger.contains(t) || menu?.contains(t)) return;
    // A tap on the field's own label toggles it through the click it sends.
    for (const l of trigger.labels ?? []) if (l.contains(t)) return;
    hide();
  }

  function listen(on: boolean) {
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('scroll', onScroll, true);
    window[method]('resize', place);
    document[method]('pointerdown', onPointerDown, true);
  }

  async function show(at?: number) {
    if (disabled || open || !options.length) return;
    // Only one menu is open at a time.
    if (document.querySelector('.dd-menu')) dismissOverlay();
    listName = label ?? nameFromLabel();
    active = at ?? (enabled(selectedIndex) ? selectedIndex : first());
    open = true;
    release = pushOverlay(() => {
      release = null;
      hide();
    });
    listen(true);
    await tick();
    if (!menu) return;
    try {
      if (!menu.matches(':popover-open')) menu.showPopover();
    } catch {
      // No popover support: the fixed position and z-index still float it.
    }
    place();
    reveal(active);
    const move = spring('spatial-default');
    const fade = spring('effects-fast');
    menu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade.duration, easing: fade.easing });
    if (!prefersReducedMotion()) {
      menu.animate([{ transform: `translateY(${above ? 8 : -8}px) scale(0.96)` }, { transform: 'none' }], {
        duration: move.duration,
        easing: move.easing,
      });
    }
  }

  function hide() {
    if (!open) return;
    open = false;
    listen(false);
    release?.();
    release = null;
    clearTimeout(typedTimer);
    typed = '';
  }

  function choose(i: number) {
    const option = options[i];
    if (!option || option.disabled) return;
    if (option.value !== value) {
      value = option.value;
      onchange?.(option.value);
    }
  }

  function moveTo(i: number) {
    active = i;
    reveal(i);
  }

  // Type to jump: letters build a short search; one repeated letter cycles.
  let typed = '';
  let typedTimer: ReturnType<typeof setTimeout> | undefined;
  function typeahead(key: string): number {
    clearTimeout(typedTimer);
    typedTimer = setTimeout(() => (typed = ''), 600);
    typed += key.toLowerCase();
    const cycling = typed.length > 1 && [...typed].every((c) => c === typed[0]);
    const needle = cycling ? typed[0]! : typed;
    const from = cycling || typed.length === 1 ? active + 1 : Math.max(active, 0);
    for (let n = 0; n < options.length; n++) {
      const i = (from + n) % options.length;
      if (enabled(i) && options[i]!.label.toLowerCase().startsWith(needle)) return i;
    }
    return -1;
  }

  function onkeydown(e: KeyboardEvent) {
    if (disabled) return;
    const k = e.key;
    const printable = k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        e.preventDefault();
        void show();
      } else if (k === 'Home' || k === 'End') {
        e.preventDefault();
        void show(k === 'Home' ? first() : last());
      } else if (printable) {
        e.preventDefault();
        const i = typeahead(k);
        void show(i >= 0 ? i : undefined);
      }
      return;
    }
    switch (k) {
      case 'ArrowDown':
        e.preventDefault();
        moveTo(step(active, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey) {
          choose(active);
          hide();
        } else moveTo(step(active, -1));
        break;
      case 'Home':
        e.preventDefault();
        moveTo(first());
        break;
      case 'End':
        e.preventDefault();
        moveTo(last());
        break;
      case 'PageDown':
      case 'PageUp': {
        e.preventDefault();
        let i = active;
        for (let n = 0; n < 10; n++) i = step(i, k === 'PageDown' ? 1 : -1);
        moveTo(i);
        break;
      }
      case 'Enter':
        e.preventDefault();
        choose(active);
        hide();
        break;
      case ' ':
        e.preventDefault();
        if (typed) moveTo(Math.max(typeahead(k), active));
        else {
          choose(active);
          hide();
        }
        break;
      case 'Escape':
        // Close the menu, not the modal or sheet it sits in.
        e.preventDefault();
        e.stopPropagation();
        hide();
        break;
      case 'Tab':
        choose(active);
        hide();
        break;
      default:
        if (printable) {
          e.preventDefault();
          const i = typeahead(k);
          if (i >= 0) moveTo(i);
        }
    }
  }

  // Space activates a button on key up; the key down already handled it.
  function onkeyup(e: KeyboardEvent) {
    if (e.key === ' ') e.preventDefault();
  }

  function pick(e: MouseEvent, i: number) {
    // Inside a <label>, a click would also be forwarded to the field and reopen it.
    e.preventDefault();
    if (!enabled(i)) return;
    choose(i);
    hide();
    trigger.focus({ preventScroll: true });
  }

  function leave(_node: Element) {
    return {
      duration: prefersReducedMotion() ? 100 : 160,
      css: (t: number) => `opacity: ${t * t}`,
    };
  }

  onDestroy(() => {
    if (open) hide();
  });
</script>

<button
  bind:this={trigger}
  type="button"
  {id}
  class="select dd-select {className}"
  role="combobox"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={listId}
  aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
  aria-label={label}
  aria-labelledby={labelledby}
  aria-describedby={describedby}
  aria-invalid={invalid || undefined}
  {disabled}
  onclick={() => (open ? hide() : void show())}
  {onkeydown}
  {onkeyup}
>
  <!-- Like a native select, the field is as wide as its longest option allows, so it never jumps. -->
  <span class="dd-select-text">
    <span class="dd-select-value" class:is-placeholder={shown === undefined}>{shown ?? placeholder}</span>
    <!-- Drawn from an attribute, so the labels stay out of the field's text. -->
    {#each options as option, i (i)}<span class="dd-select-sizer" data-label={option.label} aria-hidden="true"></span>{/each}
  </span>
  <svg
    class="dd-select-chevron"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
  >
</button>

{#snippet item(option: SelectOption<T>, i: number)}
  <!-- The keyboard works through the field (aria-activedescendant); a tap chooses directly. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    id={optionId(i)}
    class="dd-option"
    data-value={String(option.value)}
    role="option"
    tabindex="-1"
    aria-selected={i === selectedIndex}
    aria-disabled={option.disabled || undefined}
    data-active={i === active || undefined}
    onpointermove={() => {
      if (enabled(i) && active !== i) active = i;
    }}
    onclick={(e) => pick(e, i)}
  >
    <span class="dd-option-label">{option.label}</span>
    <svg
      class="dd-option-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.25"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg
    >
  </div>
{/snippet}

{#if open}
  <!-- Pressing in the menu keeps focus on the field, which drives the keyboard. -->
  <div
    bind:this={menu}
    id={listId}
    class="dd-menu"
    class:above
    role="listbox"
    tabindex="-1"
    popover="manual"
    aria-label={labelledby ? undefined : listName || undefined}
    aria-labelledby={labelledby}
    onmousedown={(e) => e.preventDefault()}
    out:leave
  >
    {#each sections as section, s (s)}
      {#if section.group}
        <div class="dd-menu-group" role="group" aria-labelledby="{uid}-group-{s}">
          <div class="dd-menu-group-label" id="{uid}-group-{s}" aria-hidden="true">{section.group}</div>
          {#each section.items as { option, index } (index)}{@render item(option, index)}{/each}
        </div>
      {:else}
        {#each section.items as { option, index } (index)}{@render item(option, index)}{/each}
      {/if}
    {/each}
  </div>
{/if}
