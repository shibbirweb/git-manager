<!-- A panel's header: its title in small capitals on the left and its action buttons on the right, like the
     Changes, Files and terminal panels. Put IconButtons with size "compact" in `actions`. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    actions?: Snippet;
  }

  let { title, actions }: Props = $props();
</script>

<header class="head">
  <span class="title">{title}</span>
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

  .title {
    min-width: 0;
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
