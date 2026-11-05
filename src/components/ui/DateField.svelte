<script lang="ts">
  // The publication date (style.md §8.6): a field that opens a calendar, never
  // a typed date. Books are often dated by year alone, so the picker chooses
  // how precise the date is: a year, a month or a day.
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';

  interface Props {
    /** "YYYY", "YYYY-MM" or "YYYY-MM-DD"; empty for none. */
    value: string;
    id?: string;
    onchange: (value: string) => void;
  }

  let { value, id, onchange }: Props = $props();

  type Precision = 'year' | 'month' | 'day';
  const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en', { month: 'short' }));
  const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now = new Date();

  let open = $state(false);
  let precision = $state<Precision>('day');
  let year = $state(now.getFullYear());
  let month = $state(0);
  let day = $state(1);
  /** The decade shown in year mode. */
  let decade = $state(Math.floor(now.getFullYear() / 10) * 10);
  let picked = $state(false);

  function parse(v: string) {
    const m = v.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
    if (!m) return null;
    return { year: +m[1]!, month: m[2] ? +m[2] - 1 : null, day: m[3] ? +m[3] : null };
  }

  const label = $derived.by(() => {
    const p = parse(value);
    if (!p) return 'No date';
    if (p.month === null) return String(p.year);
    const date = new Date(p.year, p.month, p.day ?? 1);
    return date.toLocaleDateString('en', p.day === null ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' });
  });

  function show() {
    const p = parse(value);
    picked = !!p;
    year = p?.year ?? now.getFullYear();
    month = p?.month ?? now.getMonth();
    day = p?.day ?? 1;
    precision = !p ? 'day' : p.month === null ? 'year' : p.day === null ? 'month' : 'day';
    decade = Math.floor(year / 10) * 10;
    open = true;
  }

  const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
  /** Monday-first blanks before the 1st. */
  const lead = $derived((new Date(year, month, 1).getDay() + 6) % 7);

  function stepMonth(by: number) {
    const d = new Date(year, month + by, 1);
    year = d.getFullYear();
    month = d.getMonth();
    day = Math.min(day, new Date(year, month + 1, 0).getDate());
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  function choose() {
    const out = precision === 'year' ? String(year) : precision === 'month' ? `${year}-${pad(month + 1)}` : `${year}-${pad(month + 1)}-${pad(Math.min(day, daysInMonth))}`;
    onchange(out);
    open = false;
  }

  function clear() {
    onchange('');
    open = false;
  }
</script>

<button type="button" class="picker-field" {id} data-value={value} aria-haspopup="dialog" aria-expanded={open} onclick={show}>
  <span class:placeholder={!value}>{label}</span>
</button>

{#if open}
  <Modal title="Publication date" eyebrow="Imprint" closeLabel="Close" onclose={() => (open = false)}>
    <div class="segmented" role="radiogroup" aria-label="Precision">
      {#each [['year', 'Year'], ['month', 'Month'], ['day', 'Day']] as const as [p, name] (p)}
        <button type="button" role="radio" aria-checked={precision === p} onclick={() => (precision = p)}>{name}</button>
      {/each}
    </div>

    {#if precision === 'year'}
      <div class="year-nav">
        <button type="button" class="btn-icon" aria-label="Earlier decade" onclick={() => (decade -= 10)}><Icon name="chevron-left" /></button>
        <p class="t-card-title tabular" aria-live="polite">{decade}–{decade + 9}</p>
        <button type="button" class="btn-icon" aria-label="Later decade" onclick={() => (decade += 10)}><Icon name="chevron-right" /></button>
      </div>
      <div class="hairline-grid calendar-grid cols-5">
        {#each Array.from({ length: 10 }, (_, i) => decade + i) as y (y)}
          <button type="button" class="tabular" class:current={y === now.getFullYear()} aria-pressed={picked && y === year} onclick={() => ((year = y), (picked = true))}>{y}</button>
        {/each}
      </div>
    {:else}
      <div class="year-nav">
        <button type="button" class="btn-icon" aria-label={precision === 'day' ? 'Previous month' : 'Previous year'} onclick={() => (precision === 'day' ? stepMonth(-1) : year--)}><Icon name="chevron-left" /></button>
        <p class="t-card-title tabular" aria-live="polite">{precision === 'day' ? `${MONTHS[month]} ${year}` : year}</p>
        <button type="button" class="btn-icon" aria-label={precision === 'day' ? 'Next month' : 'Next year'} onclick={() => (precision === 'day' ? stepMonth(1) : year++)}><Icon name="chevron-right" /></button>
      </div>
      {#if precision === 'month'}
        <div class="hairline-grid calendar-grid cols-4">
          {#each MONTHS as name, i (i)}
            <button type="button" class:current={now.getFullYear() === year && now.getMonth() === i} aria-pressed={picked && i === month} onclick={() => ((month = i), (picked = true))}>{name}</button>
          {/each}
        </div>
      {:else}
        <div class="calendar-weekdays" aria-hidden="true">
          {#each WEEKDAYS as w, i (i)}<span>{w}</span>{/each}
        </div>
        <div class="hairline-grid calendar-grid cols-7">
          {#each Array.from({ length: lead }, (_, i) => i) as i (`lead${i}`)}<span class="calendar-blank"></span>{/each}
          {#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as d (d)}
            <button
              type="button"
              class="tabular"
              class:current={now.getFullYear() === year && now.getMonth() === month && now.getDate() === d}
              aria-pressed={picked && d === day}
              aria-label={new Date(year, month, d).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}
              onclick={() => ((day = d), (picked = true))}>{d}</button
            >
          {/each}
        </div>
      {/if}
    {/if}

    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={clear} disabled={!value}>Clear</button>
      <button type="button" class="btn btn-primary" onclick={choose} disabled={!picked}>Choose</button>
    </div>
  </Modal>
{/if}
