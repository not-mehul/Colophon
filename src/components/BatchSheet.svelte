<script lang="ts">
  // Batch fixes for the editions picked on the bench.
  import { plural } from '../lib/format';
  import { BATCH_FIXES, runBatch, type BatchFixes } from '../state/batch';
  import { library } from '../state/library.svelte';
  import { ui } from '../state/ui.svelte';
  import Sheet from './ui/Sheet.svelte';
  import Switch from './ui/Switch.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let fixes = $state<BatchFixes>({ coverTags: true, orphans: true, number: false, validation: true, rename: false });
  let progress = $state<number | null>(null);
  const count = $derived(library.selected.length);
  const any = $derived(Object.values(fixes).some(Boolean));

  async function run() {
    progress = 0;
    const ids = [...library.selected];
    const result = await runBatch(ids, $state.snapshot(fixes), (n) => (progress = n));
    progress = null;
    library.clearSelection();
    onclose();
    const tail = result.failed.length ? ` ${plural(result.failed.length, 'edition')} couldn't be read.` : '';
    if (result.done) ui.undoable(`Fixed ${plural(result.done, 'edition')}.${tail}`, () => void result.undo());
    else ui.notify(`Nothing was fixed.${tail}`, 'error');
  }
</script>

<Sheet title="Fix {plural(count, 'edition')}" {onclose}>
  <p class="t-body-small">Each edition is fixed and bound again in the library. Undo puts the old files back.</p>
  <div class="settings-list">
    {#each BATCH_FIXES as fix (fix.id)}
      <Switch checked={fixes[fix.id]} label={fix.label} hint={fix.hint} onchange={(on) => (fixes[fix.id] = on)} />
    {/each}
  </div>
  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-muted" onclick={onclose}>Cancel</button>
      <button type="button" class="btn btn-primary" id="runBatch" disabled={!any || progress !== null} onclick={() => void run()}>
        {progress === null ? `Fix ${plural(count, 'edition')}` : `Fixing ${progress + 1} of ${count}…`}
      </button>
    </div>
  {/snippet}
</Sheet>
