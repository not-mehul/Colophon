<script lang="ts">
  // style.md §8.6, Pickers. A clock time: a field shaped like a text input
  // that opens a picker modal in place of Android's own clock. Twenty-four
  // hours, then the minutes in fives, then +1 to +4 for the ones that are not,
  // all on one six-wide grid, so no time is ever rounded. Nothing changes
  // until Choose; Cancel, Escape, a backdrop tap and Android back (through
  // dismissOverlay) leave the value as it was. From Waymark's clock.
  import { tick } from 'svelte';
  import { pushOverlay } from './overlay.js';

  interface Words {
    hour: string;
    minute: string;
    cancel: string;
    choose: string;
    close: string;
    /** Shown in the field when there is no time yet. */
    empty: string;
    /** Names a +n button for screen readers. */
    plusMinutes: (n: number) => string;
  }

  interface Props {
    /** "HH:MM" in 24-hour time, or "" for none. */
    value: string;
    label: string;
    /** The field's DOM id. */
    id: string;
    onchange: (value: string) => void;
    /** Formats times for the reader's locale (12 or 24 hours). Defaults to the page's. */
    locale?: string;
    /** The picker's own words, for apps in other languages. */
    words?: Partial<Words>;
  }

  let { value, label, id, onchange, locale, words = {} }: Props = $props();

  const w = $derived<Words>({
    hour: 'Hour',
    minute: 'Minute',
    cancel: 'Cancel',
    choose: 'Choose',
    close: 'Close',
    empty: 'Choose a time',
    plusMinutes: (n) => `Plus ${n} ${n === 1 ? 'minute' : 'minutes'}`,
    ...words,
  });

  const HOURS = Array.from({ length: 24 }, (_, h) => h);
  const FIVES = Array.from({ length: 12 }, (_, i) => i * 5);
  const ONES = [1, 2, 3, 4];
  const pad = (n: number) => String(n).padStart(2, '0');

  function parse(v: string): { hour: number; minute: number } | null {
    const m = /^(\d{1,2}):(\d{2})/.exec(v);
    if (!m) return null;
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    return hour < 24 && minute < 60 ? { hour, minute } : null;
  }

  const at = (hour: number, minute: number) => new Date(2000, 0, 1, hour, minute);
  const timeText = $derived(new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }));
  const hourText = $derived(new Intl.DateTimeFormat(locale, { hour: 'numeric' }));
  const current = $derived(parse(value));

  let dialog = $state<HTMLDialogElement | null>(null);
  let open = $state(false);
  let hour = $state(12);
  let minute = $state(0);
  let release: (() => void) | null = null;
  let returnTo: HTMLElement | null = null;

  async function start() {
    hour = current?.hour ?? 12;
    minute = current?.minute ?? 0;
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open = true;
    release = pushOverlay(() => {
      release = null;
      close();
    });
    await tick();
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  }

  function close() {
    release?.();
    release = null;
    dialog?.close();
    open = false;
    if (returnTo?.isConnected) returnTo.focus();
  }

  function choose() {
    const next = `${pad(hour)}:${pad(minute)}`;
    close();
    if (next !== value) onchange(next);
  }
</script>

<div class="field">
<span class="t-field-label" id="{id}-label">{label}</span>
<button
  type="button"
  class="picker-field dd-time-field"
  {id}
  aria-labelledby="{id}-label {id}-value"
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={start}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg
  >
  {#if current}
    <span class="dd-time-value" id="{id}-value">{timeText.format(at(current.hour, current.minute))}</span>
  {:else}
    <span class="dd-time-value is-placeholder" id="{id}-value">{w.empty}</span>
  {/if}
</button>
</div>

{#if open}
  <dialog
    bind:this={dialog}
    class="modal-dialog dd-picker"
    aria-labelledby="{id}-picker-title"
    onclick={(ev) => {
      if (ev.target === dialog) close();
    }}
    oncancel={(ev) => {
      ev.preventDefault();
      close();
    }}
  >
    <div class="modal-card dd-picker-card">
      <div class="modal-head dd-picker-head">
        <div class="modal-head-text">
          <p class="modal-eyebrow">{label}</p>
          <h2 class="modal-title" id="{id}-picker-title" aria-live="polite">{timeText.format(at(hour, minute))}</h2>
        </div>
        <button type="button" class="btn-icon" aria-label={w.close} onclick={close}
          ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            ><path d="M18 6 6 18M6 6l12 12" /></svg
          ></button
        >
      </div>
      <div class="dd-picker-section">
        <span class="t-field-label" id="{id}-hours">{w.hour}</span>
        <div class="dd-picker-grid" role="group" aria-labelledby="{id}-hours">
          {#each HOURS as h (h)}
            <button type="button" class="dd-picker-cell" aria-pressed={h === hour} onclick={() => (hour = h)}
              >{hourText.format(at(h, 0))}</button
            >
          {/each}
        </div>
      </div>
      <div class="dd-picker-section">
        <span class="t-field-label" id="{id}-minutes">{w.minute}</span>
        <div class="dd-picker-grid" role="group" aria-labelledby="{id}-minutes">
          {#each FIVES as m (m)}
            <button
              type="button"
              class="dd-picker-cell"
              aria-pressed={m === minute - (minute % 5)}
              onclick={() => (minute = m + (minute % 5))}>:{pad(m)}</button
            >
          {/each}
          {#each ONES as n (n)}
            <button
              type="button"
              class="dd-picker-cell"
              aria-pressed={minute % 5 === n}
              aria-label={w.plusMinutes(n)}
              onclick={() => (minute = minute - (minute % 5) + (minute % 5 === n ? 0 : n))}>+{n}</button
            >
          {/each}
        </div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-muted" onclick={close}>{w.cancel}</button>
        <button type="button" class="btn btn-primary" id="{id}-choose" onclick={choose}>{w.choose}</button>
      </div>
    </div>
  </dialog>
{/if}
