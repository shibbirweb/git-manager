<!-- A path as crumbs, like the Navigation Bar: each part is a small button, separated by chevrons. The last part
     (the file) is bold; `open` marks the part whose list is showing. When narrow, the farthest crumbs shorten first
     (logic/crumbs.ts) and the file name last. Crumbs never take the focus, so the keyboard stays where it was. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import { crumbShrink } from "../logic/crumbs";
  import FileIcon, { type FileIconView } from "./FileIcon.svelte";
  import Icon from "./Icon.svelte";

  interface Crumb {
    label: string;
    icon?: IconName;
    /** A file type icon instead of `icon`, such as the file's own. */
    fileIcon?: FileIconView | null;
    kind?: "repo" | "folder" | "file";
  }

  interface Props {
    crumbs: Crumb[];
    label?: string;
    open?: number | null;
    variant?: "inline" | "floating" | "anchored";
    /** Anchored: where the bar sits in the window, such as the focused editor's top left. */
    at?: { top: number; left: number; maxWidth: number } | null;
    title?: string;
    element?: HTMLElement | null;
    onselect?: (index: number, element: HTMLElement) => void;
  }

  let {
    crumbs,
    variant = "inline",
    label = "Path",
    open = null,
    at = null,
    title,
    element = $bindable(null),
    onselect,
  }: Props = $props();

  /** A crumb's button, to open its list from the keyboard. */
  export function crumbElement(index: number): HTMLElement | null {
    return element?.querySelectorAll<HTMLElement>(".crumb")[index] ?? null;
  }
</script>

<nav
  bind:this={element}
  class="crumbs {variant}"
  aria-label={label}
  {title}
  style:top={at ? `${at.top}px` : null}
  style:left={at ? `${at.left}px` : null}
  style:max-width={at ? `${at.maxWidth}px` : null}
>
  {#each crumbs as crumb, index (index)}
    {#if index > 0}
      <span class="sep" aria-hidden="true"><Icon name="chevron-right" size="compact" /></span>
    {/if}
    <button
      class="crumb {crumb.kind ?? 'folder'}"
      class:open={open === index}
      class:has-icon={crumb.icon !== undefined || crumb.fileIcon !== undefined}
      type="button"
      tabindex="-1"
      style:flex-shrink={crumbShrink(index, crumbs.length)}
      aria-current={index === crumbs.length - 1 ? "location" : undefined}
      aria-haspopup={onselect ? "listbox" : undefined}
      aria-expanded={onselect ? open === index : undefined}
      onmousedown={(event) => event.preventDefault()}
      onclick={(event) => onselect?.(index, event.currentTarget)}
    >
      {#if crumb.fileIcon !== undefined}
        <FileIcon view={crumb.fileIcon} size="compact" />
      {:else if crumb.icon}
        <Icon name={crumb.icon} size="compact" />
      {/if}
      <span class="crumb-name">{crumb.label}</span>
    </button>
  {/each}
</nav>

<style>
  /* Overflow goes off the left edge, so the file name is the last thing to disappear. */
  .crumbs {
    flex: 0 1 auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  /* The Navigation Bar on its own, over the top of the window (centered, or anchored where the caller puts it). */
  .floating,
  .anchored {
    position: fixed;
    top: var(--breadcrumbs-floating-top);
    z-index: 885;
    max-width: calc(100vw - 2 * var(--space-8));
    height: var(--breadcrumbs-floating-height);
    padding: 0 var(--breadcrumbs-floating-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--panel);
    box-shadow: var(--shadow);
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .floating {
    left: 50%;
    transform: translateX(-50%);
  }

  /* flex-shrink comes from the markup; a crumb keeps room for an ellipsis (and its icon). */
  .crumb {
    flex-grow: 0;
    flex-basis: auto;
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

  .crumb.has-icon {
    min-width: calc(var(--icon-size-large) + 1.4em);
  }

  .crumb > :global(*:not(.crumb-name)) {
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
