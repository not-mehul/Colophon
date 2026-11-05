<script lang="ts">
  // EPUB Accessibility 1.1 discovery metadata: what the book offers, said
  // plainly. Starts from a suggestion drawn from the inspection.
  import { CONFORMS_TO, FEATURES } from '../../epub/accessibility';
  import type { A11yMeta } from '../../epub/types';
  import { bench } from '../../state/bench.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Switch from '../ui/Switch.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const existing = bench.draft.a11y ?? bench.edition!.a11y;
  const start: A11yMeta = existing.accessModes.length || existing.summary ? $state.snapshot(existing) : bench.suggestedA11y()!;
  let meta = $state<A11yMeta>(structuredClone(start));
  const report = bench.access!;
  const canConform = !report.missingAlt.length && !report.missingLang.length && bench.toc.length > 0;

  function toggleFeature(id: string, on: boolean) {
    meta.features = on ? [...new Set([...meta.features, id])] : meta.features.filter((f) => f !== id);
  }

  function save() {
    const value = $state.snapshot(meta);
    bench.withUndo('Accessibility metadata set.', () => (bench.draft.a11y = value));
    onclose();
  }
</script>

<Sheet title="Accessibility metadata" {onclose}>
  <div class="form-stack">
    <div class="field">
      <span class="t-field-label">Features</span>
      <div class="chip-row">
        {#each FEATURES as f (f.id)}
          <button type="button" class="chip" aria-pressed={meta.features.includes(f.id)} onclick={() => toggleFeature(f.id, !meta.features.includes(f.id))}>{f.label}</button>
        {/each}
      </div>
    </div>
    <div class="field">
      <span class="t-field-label">Read by</span>
      <div class="segmented" role="radiogroup" aria-label="Access modes">
        <button type="button" role="radio" aria-checked={meta.accessModes.length === 1} onclick={() => ((meta.accessModes = ['textual']), (meta.accessModeSufficient = ['textual']))}>Text only</button>
        <button type="button" role="radio" aria-checked={meta.accessModes.length > 1} onclick={() => (meta.accessModes = ['textual', 'visual'])}>Text and images</button>
      </div>
    </div>
    <Switch checked={meta.hazards.includes('none')} label="No hazards" hint="No flashing, motion simulation or sound." onchange={(on) => (meta.hazards = on ? ['none'] : ['unknown'])} />
    <label class="field">
      <span class="t-field-label">Summary</span>
      <textarea class="textarea" rows="3" bind:value={meta.summary}></textarea>
    </label>
    <Switch
      checked={!!meta.conformsTo}
      label="Conforms to WCAG 2.2 AA"
      hint={canConform ? CONFORMS_TO : 'Add alt text, languages and contents first.'}
      onchange={(on) => (meta.conformsTo = on && canConform ? CONFORMS_TO : '')}
    />
  </div>
  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={() => (meta = structuredClone(bench.suggestedA11y()!))}>Suggest</button>
      <button type="button" class="btn btn-primary" id="saveA11y" onclick={save}>Set metadata</button>
    </div>
  {/snippet}
</Sheet>
