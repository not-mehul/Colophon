<script lang="ts">
  // Colophon's idle toy: a composing stick. Press the sort and a pangram is set,
  // one letter after another; set all five and it is an easter egg.
  import { play } from 'dusk-dawn';
  import { cheer, hatch } from '../lib/delight';

  const PANGRAMS = [
    'Sphinx of black quartz, judge my vow.',
    'Pack my box with five dozen liquor jugs.',
    'How vexingly quick daft zebras jump!',
    'The five boxing wizards jump quickly.',
    'Jackdaws love my big sphinx of quartz.',
  ];

  let set = $state(0);
  let pressing = $state(false);
  let toy = $state<HTMLButtonElement>();
  const line = $derived(set === 0 ? '' : PANGRAMS[(set - 1) % PANGRAMS.length]!);
  // Words hold together on the line; each letter still drops in on its own.
  const words = $derived.by(() => {
    let at = 0;
    return line.split(' ').map((word) => [...word].map((letter) => ({ letter, i: at++ })));
  });

  function press() {
    set += 1;
    pressing = false;
    requestAnimationFrame(() => (pressing = true));
    if (set === PANGRAMS.length) {
      play(toy, 'tada');
      cheer(toy, { count: 36, spread: 0.6 });
      hatch('stick', 'A full case: every letter set, five times over.');
    }
  }
</script>

<button type="button" class="idle-toy" class:is-pressing={pressing} bind:this={toy} aria-label="Set a line" onclick={press} onanimationend={() => (pressing = false)}>
  <!-- Generated content with empty alt text: a picture of a sort, not a word to read out. -->
  <span class="sort"></span>
</button>
<p class="idle-line" aria-live="polite">
  {#if line}
    {#key set}
      <span class="visually-hidden">{line}</span>
      <span class="set" aria-hidden="true">{#each words as word, w (w)}<span class="word">{#each word as { letter, i } (i)}<span class="letter" style:--i={i}>{letter}</span>{/each}</span>{' '}{/each}</span>
    {/key}
  {:else}
    Press the sort to set a line.
  {/if}
</p>

<style>
  .sort {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 2rem;
    line-height: 1;
    color: var(--accent-amber);
  }
  .sort::before {
    content: '&' / '';
  }
  .word {
    display: inline-block;
    white-space: nowrap;
  }
  .letter {
    display: inline-block;
  }
  @media (prefers-reduced-motion: no-preference) {
    /* The sort goes down into the stick, and each letter drops into the line after it. */
    .is-pressing .sort {
      animation: press 360ms var(--ease-standard);
    }
    .letter {
      animation: drop-in var(--spring-spatial-fast-dur) var(--spring-spatial-fast) both;
      animation-delay: calc(var(--i) * 14ms);
    }
  }
  @keyframes press {
    40% {
      transform: translateY(3px) scale(0.9);
    }
  }
  @keyframes drop-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
  }
</style>
