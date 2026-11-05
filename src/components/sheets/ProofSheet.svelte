<script lang="ts">
  // The proof: every change the bound copy will carry, grouped as the tabs
  // are, each with the value as opened struck through above the new one.
  // Any single change can be put back; everything can be, with Undo.
  import { GROUP_LABELS, type ChangeGroup } from '../../epub/changes';
  import { plural } from '../../lib/format';
  import { bench } from '../../state/bench.svelte';
  import Icon from '../ui/Icon.svelte';
  import Sheet from '../ui/Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const ORDER: ChangeGroup[] = ['imprint', 'cover', 'chapters', 'repairs'];
  const groups = $derived(ORDER.map((g) => ({ id: g, label: GROUP_LABELS[g], items: bench.proof.filter((c) => c.group === g) })).filter((g) => g.items.length));
  const gain = $derived(bench.gain);

  function bind() {
    onclose();
    void bench.bindAndSave();
  }
</script>

<Sheet title="The proof" {onclose}>
  {#if !bench.proof.length}
    <p class="empty-match">Nothing to bind yet. Changes you make in Imprint, Chapters and Inspection are listed here before they're written.</p>
  {:else}
    <p class="t-body-small dim proof-summary">
      {plural(bench.proof.length, 'change')} from <span class="t-data-small">{bench.edition?.fileName}</span>.
      {#if gain > 0}They lift the score from {bench.baseline.score} to <span class="sage">{bench.audit.score}</span>.{:else if gain < 0}They lower the score from {bench.baseline.score} to <span class="amber">{bench.audit.score}</span>.{:else}The score stays at {bench.audit.score}.{/if}
    </p>
    {#each groups as group (group.id)}
      <section class="proof-group" aria-label={group.label}>
        <h3 class="t-section-label">{group.label}</h3>
        <ul class="proof-list">
          {#each group.items as change (change.id)}
            <li class="proof-row">
              <div class="proof-text">
                <span class="t-field-label">{change.label}</span>
                <span class="compare-old" class:struck={!!change.before}>{change.before || 'Not set'}</span>
                <span class="proof-new">{change.after || 'Removed'}</span>
              </div>
              <button type="button" class="btn-icon" aria-label="Put back {change.label}" onclick={() => bench.revertChange(change.id)}><Icon name="undo-2" /></button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
    <p class="t-hint dim"><em>Proof.</em> Nothing is written until you bind. Each arrow puts one change back as it was opened.</p>
  {/if}
  {#snippet footer()}
    <div class="btn-row">
      <button type="button" class="btn btn-muted" id="revertAll" disabled={!bench.proof.length} onclick={() => bench.revertAll()}>Put all back</button>
      <button type="button" class="btn btn-primary" id="proofBind" disabled={!bench.proof.length || bench.busy !== null} onclick={bind}><Icon name="book-check" />Bind</button>
    </div>
  {/snippet}
</Sheet>
