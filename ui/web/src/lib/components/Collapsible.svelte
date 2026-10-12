<!-- A section with a header that opens and closes it: a chevron, a bold title, a count, and actions (icon buttons
     show while the header is hovered), like the Changes list's groups. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    open?: boolean;
    count?: number | null;
    nested?: boolean;
    dim?: boolean;
    actions?: Snippet;
    ontoggle?: (open: boolean) => void;
    children: Snippet;
  }

  let {
    title,
    open = $bindable(true),
    count = null,
    nested = false,
    dim = false,
    actions,
    ontoggle,
    children,
  }: Props = $props();
</script>

<section aria-label={title}>
  <div class="header" class:nested>
    <button
      class="toggle"
      class:dim
      type="button"
      aria-expanded={open}
      onclick={() => {
        open = !open;
        ontoggle?.(open);
      }}
    >
      <Icon name={open ? "chevron-down" : "chevron-right"} size="medium" />
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
    gap: var(--space-2);
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
    padding: 0 var(--space-2);
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    cursor: pointer;
    text-align: left;
  }

  /* A quieter section, like the repositories with No Changes. */
  .toggle.dim {
    color: var(--text-dim);
  }

  .title {
    font-weight: var(--font-weight-semibold);
  }

  .count {
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  /* Icon actions show while the header is hovered; a worded button (Resolve...) always shows. */
  .actions {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .actions > :global(.icon-button) {
    display: none;
  }

  .header:hover .actions > :global(.icon-button),
  .header:focus-within .actions > :global(.icon-button) {
    display: inline-flex;
  }
</style>
