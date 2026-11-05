<script lang="ts">
  // Alt text for each image that has none. "Decorative" writes alt="" so
  // screen readers skip it.
  import { imageMime } from '../../epub/image-size';
  import { plural } from '../../lib/format';
  import { bench } from '../../state/bench.svelte';
  import BlobImg from '../ui/BlobImg.svelte';
  import Sheet from '../ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const missing = $state.snapshot(bench.access?.missingAlt ?? []);
  let values = $state<string[]>(missing.map(() => ''));
  let decorative = $state<boolean[]>(missing.map(() => false));
  const ready = $derived(missing.filter((_, i) => decorative[i] || values[i]!.trim()).length);
  const docTitle = (path: string) => bench.titles.get(bench.draft.chapters.find((c) => c.path === path)?.id ?? '') ?? path.split('/').pop();

  function save() {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- built and handed off, never rendered
    const alts = new Map<string, Map<number, string>>();
    missing.forEach((m, i) => {
      const alt = decorative[i] ? '' : values[i]!.trim();
      if (!decorative[i] && !alt) return;
      if (!alts.has(m.doc)) alts.set(m.doc, new Map());
      alts.get(m.doc)!.set(m.index, alt);
    });
    if (bench.setAltText(alts)) onclose();
  }
</script>

<Sheet title="Alt text" {onclose}>
  <p class="t-body-small">Describe what each image shows, in a sentence. Mark ornaments and rules as decorative.</p>
  <ul class="alt-list">
    {#each missing as m, i (`${m.doc}:${m.index}`)}
      {@const file = bench.edition?.files.get(m.image)}
      <li class="alt-row">
        <span class="alt-thumb">{#if file}<BlobImg bytes={file} type={imageMime(file)} alt="" />{/if}</span>
        <div class="form-stack">
          <p class="t-data-small dim ellipsis">{docTitle(m.doc)} · image {m.index + 1}</p>
          <input class="input" bind:value={values[i]} disabled={decorative[i]} placeholder="What the image shows" aria-label="Alt text for image {i + 1}" />
          <label class="check-label"><input type="checkbox" class="check" bind:checked={decorative[i]} />Decorative</label>
        </div>
      </li>
    {/each}
  </ul>
  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={onclose}>Cancel</button>
      <button type="button" class="btn btn-primary" id="saveAlt" disabled={!ready} onclick={save}>Write {plural(ready, 'image')}</button>
    </div>
  {/snippet}
</Sheet>
