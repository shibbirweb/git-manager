<!-- The bar across the top of the window: navigation and pickers on the left (they shrink and truncate first), the
     busy indicator and actions on the right. Vertical Dividers inside take the header's length. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Spinner from "./Spinner.svelte";

  interface Props {
    busy?: string;
    busyTitle?: string;
    start: Snippet;
    end?: Snippet;
  }

  let { busy = "", busyTitle, start, end }: Props = $props();
</script>

<header class="header">
  <div class="start">{@render start()}</div>
  <div class="end">
    {#if busy}
      <div class="busy" title={busyTitle ?? busy}>
        <Spinner size="small" label={busy} />
        <span class="busy-text">{busy}</span>
      </div>
    {/if}
    {@render end?.()}
  </div>
</header>

<style>
  .header {
    --divider-length: var(--app-header-divider-length);
    --divider-space: var(--app-header-side-gap);
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--app-header-gap);
    height: var(--app-header-height);
    padding: 0 var(--app-header-padding-x);
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
  }

  .start,
  .end {
    display: flex;
    align-items: center;
    gap: var(--app-header-side-gap);
    min-width: 0;
  }

  .start {
    overflow: hidden;
  }

  /* Pickers shrink by default; parts with flex: none (dividers, history buttons) keep their size. */
  .start > :global(*) {
    min-width: 0;
  }

  .end {
    justify-content: flex-end;
  }

  .busy {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-width: var(--app-header-busy-max-width);
    margin-right: var(--space-3);
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .busy-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
