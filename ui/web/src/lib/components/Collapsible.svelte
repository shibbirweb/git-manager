<!-- A section with a header that opens and closes it: a chevron, a bold title, a count, and actions that show
     while the header is hovered, like the Changes list's groups. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    open?: boolean;
    count?: number | null;
    nested?: boolean;
    actions?: Snippet;
    ontoggle?: (open: boolean) => void;
    children: Snippet;
  }

  let { title, open = $bindable(true), count = null, nested = false, actions, ontoggle, children }: Props = $props();
</script>

<section aria-label={title}>
  <div class="header" class:nested>
    <button
      class="toggle"
      type="button"
      aria-expanded={open}
      onclick={() => {
        open = !open;
        ontoggle?.(open);
      }}
    >
      <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />
      <span class="title">{title}</span>
      {#if count !== null}
        <span class="count">{count}</span>
      {/if}
    </button>
    {#if actions}
      <span class="actions">{@render actions()}</span>
    {/if}
  </div>
  {#if open}
    {@render children()}
  {/if}
</section>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 4px;
    height: var(--collapsible-height);
    padding: 0 var(--collapsible-padding-right) 0 var(--collapsible-padding-left);
  }

  .nested {
    padding-left: var(--collapsible-nested-indent);
  }

  .header:hover {
    background: var(--hover);
  }

  .toggle {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--collapsible-gap);
    height: 100%;
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  .title {
    font-weight: var(--font-weight-semibold);
  }

  .count {
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .actions {
    display: none;
    align-items: center;
    gap: 1px;
  }

  .header:hover .actions,
  .header:focus-within .actions {
    display: flex;
  }
</style>
