<!-- A path as crumbs, like the Navigation Bar: each part is a small button, separated by chevrons. The last part
     (the file) is bold; `open` marks the part whose list is showing. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Crumb {
    label: string;
    icon?: IconName;
    kind?: "repo" | "folder" | "file";
  }

  interface Props {
    crumbs: Crumb[];
    label?: string;
    open?: number | null;
    onselect?: (index: number, element: HTMLElement) => void;
  }

  let { crumbs, label = "Path", open = null, onselect }: Props = $props();
</script>

<nav class="crumbs" aria-label={label}>
  {#each crumbs as crumb, index (index)}
    {#if index > 0}
      <span class="sep" aria-hidden="true"><Icon name="chevron-right" size={12} /></span>
    {/if}
    <button
      class="crumb {crumb.kind ?? 'folder'}"
      class:open={open === index}
      type="button"
      aria-current={index === crumbs.length - 1 ? "location" : undefined}
      onclick={(event) => onselect?.(index, event.currentTarget)}
    >
      {#if crumb.icon}
        <Icon name={crumb.icon} size={14} />
      {/if}
      <span class="crumb-name">{crumb.label}</span>
    </button>
  {/each}
</nav>

<style>
  .crumbs {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
  }

  .crumb {
    display: inline-flex;
    align-items: center;
    gap: var(--breadcrumbs-gap);
    min-width: 1.4em;
    height: var(--breadcrumbs-height);
    padding: 0 var(--breadcrumbs-padding-x);
    overflow: hidden;
    border: none;
    border-radius: var(--breadcrumbs-radius);
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }

  .crumb:hover {
    background: var(--hover);
    color: var(--text);
  }

  .crumb.open {
    background: var(--selected);
    color: var(--text);
  }

  .crumb > :global(svg) {
    flex: none;
  }

  .crumb-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .repo {
    color: var(--accent);
  }

  .file {
    color: var(--text);
    font-weight: var(--font-weight-semibold);
  }

  .sep {
    flex: none;
    display: inline-flex;
    color: var(--text-faint);
  }
</style>
