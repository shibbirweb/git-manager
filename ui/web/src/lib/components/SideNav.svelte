<!-- A vertical list of sections with the open one marked, like Settings' Appearance, Editor, Git... A `danger`
     item (Reset) shows in red. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface NavItem {
    id: string;
    label: string;
    icon?: IconName;
    danger?: boolean;
  }

  interface Props {
    items: NavItem[];
    active?: string | null;
    label: string;
    variant?: "settings" | "large" | "links";
    /** Shown when there are no items, such as a search that finds no section. */
    emptyText?: string;
    onselect?: (id: string) => void;
  }

  let { items, active = $bindable(null), label, variant = "settings", emptyText = "", onselect }: Props = $props();
</script>

<nav class="nav {variant}" aria-label={label}>
  {#each items as item (item.id)}
    <button
      class="nav-item"
      class:active={item.id === active}
      class:danger={item.danger}
      type="button"
      aria-current={item.id === active ? "page" : undefined}
      onclick={() => {
        active = item.id;
        onselect?.(item.id);
      }}
    >
      {#if item.icon}<Icon name={item.icon} size="normal" />{/if}
      {item.label}
    </button>
  {:else}
    {#if emptyText}<div class="empty">{emptyText}</div>{/if}
  {/each}
</nav>

<style>
  .nav {
    display: flex;
    flex-direction: column;
    gap: var(--side-nav-gap);
  }

  .empty {
    padding: var(--side-nav-item-padding-y) var(--side-nav-item-padding-x);
    color: var(--text-dim);
  }

  .nav-item {
    padding: var(--side-nav-item-padding-y) var(--side-nav-item-padding-x);
    border: none;
    border-radius: var(--side-nav-radius);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .nav-item:hover {
    background: var(--hover);
  }

  .active {
    background: var(--selected);
    font-weight: var(--font-weight-medium);
  }

  .danger {
    color: var(--danger);
    font-size: var(--font-size-small);
  }

  /* The Welcome page's sections. */
  .large .nav-item,
  .links .nav-item {
    display: flex;
    align-items: center;
    padding: 0 var(--side-nav-large-padding-x);
    border-radius: var(--radius-control);
  }

  .large .nav-item {
    height: var(--side-nav-large-height);
  }

  .large .active {
    font-weight: inherit;
  }

  /* Links under them: dim, with an icon, never marked active. */
  .links .nav-item {
    gap: var(--side-nav-link-gap);
    height: var(--side-nav-link-height);
    color: var(--text-dim);
  }

  .links .nav-item:hover {
    color: var(--text);
  }

  .links .active {
    background: transparent;
    font-weight: inherit;
  }
</style>
