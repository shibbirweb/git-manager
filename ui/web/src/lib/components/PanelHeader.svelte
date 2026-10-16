<!-- A panel's header: its title in small capitals (and a count) on the left and its action buttons on the right,
     like the Changes, Files and terminal panels. Put IconButtons with size "compact" in `actions`. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Badge from "./Badge.svelte";

  interface Props {
    title: string;
    /** A quiet count after the title, such as the number of changed files. */
    count?: number | null;
    actions?: Snippet;
  }

  let { title, count = null, actions }: Props = $props();
</script>

<header class="head">
  <span class="title">{title}</span>
  {#if count !== null}
    <Badge {count} tone="quiet" size="large" />
  {/if}
  <span class="spacer"></span>
  {@render actions?.()}
</header>

<style>
  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--panel-header-gap);
    height: var(--panel-header-height);
    padding: 0 var(--panel-header-padding-right) 0 var(--panel-header-padding-left);
    border-bottom: 1px solid var(--border-strong);
  }

  /* The title gives way first in a narrow panel, so the buttons never run into each other. */
  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-panel-tab-size);
    font-weight: var(--text-panel-tab-weight);
    text-transform: var(--text-panel-tab-transform);
    letter-spacing: var(--text-panel-tab-letter-spacing);
    color: var(--text-dim);
  }

  .spacer {
    flex: 1;
  }
</style>
