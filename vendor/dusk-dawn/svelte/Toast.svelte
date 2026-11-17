<script lang="ts">
  // style.md §8.12. Shared by every Dusk & Dawn app through this package.
  // One toast at a time, at the bottom centre. It pauses while touched, and a
  // failure is announced as an alert.
  //
  // A modal <dialog> makes everything outside it inert, top-layer popovers
  // included, so a toast in the page couldn't be tapped while a modal was open
  // (its Undo, say). While one is open the toast's regions live inside the
  // topmost modal, and go back to their place in the page when it closes.
  interface Props {
    toast: {
      key: number;
      message: string;
      kind: string;
      action?: { label: string };
      leaving?: boolean;
    } | null;
    onpause: () => void;
    onresume: () => void;
    onaction: () => void;
  }

  let { toast, onpause, onresume, onaction }: Props = $props();
  let layer: HTMLDivElement;

  $effect(() => {
    // Where the toast lives when no modal is open.
    const home = document.createComment('toast');
    layer.before(home);
    const place = () => {
      const modals = [...document.querySelectorAll('dialog[open]')].filter((d) => d.matches(':modal'));
      // Nested modals come later in the document than the one they open from.
      const top = modals.at(-1);
      if (top) {
        if (layer.parentNode !== top) top.append(layer);
      } else if (layer.previousSibling !== home) {
        home.after(layer);
      }
    };
    const watch = new MutationObserver(place);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    place();
    return () => {
      watch.disconnect();
      home.after(layer);
      home.remove();
    };
  });
</script>

<!-- Live regions stay in the page so screen readers hear what arrives in them. -->
<div class="toast-layer" bind:this={layer}>
  {#each ['status', 'alert'] as region (region)}
    <div class="toast-region" role={region}>
      {#if toast && (toast.kind === 'error') === (region === 'alert')}
        {#key toast.key}
          <!-- Touching the toast holds it on screen; it is not a control itself. -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="toast"
            class:leaving={toast.leaving}
            id="toast"
            data-kind={toast.kind}
            onpointerenter={onpause}
            onpointerdown={onpause}
            onpointerleave={onresume}
            onpointerup={onresume}
            onpointercancel={onresume}
          >
            <span class="toast-text">{toast.message}</span>
            {#if toast.action}
              <button type="button" class="toast-action" onclick={onaction}>{toast.action.label}</button>
            {/if}
          </div>
        {/key}
      {/if}
    </div>
  {/each}
</div>
