<script lang="ts">
  // A settings switch (style.md §8.18): the whole row is the target, and
  // it reads as a switch to assistive technology (§15).
  interface Props {
    checked: boolean;
    label: string;
    /** One line under the label, in the field-hint style. */
    hint?: string;
    id?: string;
    onchange: (checked: boolean) => void;
  }

  let { checked, label, hint, id, onchange }: Props = $props();
</script>

<button type="button" class="switch-row" role="switch" aria-checked={checked} {id} onclick={() => onchange(!checked)}>
  <span class="switch-text">
    <span class="switch-label">{label}</span>
    {#if hint}<span class="field-hint">{hint}</span>{/if}
  </span>
  <span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
</button>
