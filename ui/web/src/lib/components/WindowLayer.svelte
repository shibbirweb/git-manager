<!-- A modal page over the whole window, such as the merge tool: no dimming and no frame, its content fills it as a
     column (a Toolbar at the top, then a growing view). It takes the focus when it opens and gives it back when it
     goes; the content handles Esc, since leaving may need a question first. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    children: Snippet;
  }

  let { label, children }: Props = $props();

  let element = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!element) {
      return;
    }
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.focus();
    return () => {
      if (returnFocus?.isConnected) {
        returnFocus.focus();
      }
    };
  });
</script>

<div bind:this={element} class="layer" role="dialog" aria-modal="true" aria-label={label} tabindex="-1">
  {@render children()}
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: var(--window-layer-layer);
    display: flex;
    flex-direction: column;
    background: var(--panel);
    outline: none;
  }
</style>
