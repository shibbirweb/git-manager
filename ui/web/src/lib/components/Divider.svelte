<!-- A 1px line between groups: horizontal by default, vertical in toolbars, where it takes the toolbar's length
     and spacing. -->
<script lang="ts">
  import { useNarrow } from "../logic/barSize.svelte";
  import type { NarrowStep } from "../logic/breakpoints";

  interface Props {
    direction?: "horizontal" | "vertical";
    strong?: boolean;
    /** Inside a responsive Toolbar or Stack this narrow or narrower, the line goes. */
    hideAt?: NarrowStep | null;
  }

  let { direction = "horizontal", strong = true, hideAt = null }: Props = $props();
  const narrow = useNarrow(() => hideAt);
</script>

{#if !narrow()}
  <div class="divider {direction}" class:strong role="separator" aria-orientation={direction}></div>
{/if}

<style>
  .divider {
    flex: none;
    background: var(--border);
  }

  .strong {
    background: var(--border-strong);
  }

  .horizontal {
    height: 1px;
    align-self: stretch;
  }

  .vertical {
    width: 1px;
    height: var(--divider-length, var(--toolbar-divider-length));
    margin: 0 var(--divider-space, 0);
    align-self: center;
  }
</style>
