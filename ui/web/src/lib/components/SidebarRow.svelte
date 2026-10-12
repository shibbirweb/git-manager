<!-- A row of the sidebar's lists: branches, tags, stashes and worktrees. A chevron for groups, an icon (accent for
     the current branch), the name, then a count, ahead/behind numbers, dim detail and the row's buttons on hover.
     `section` draws a group heading in small capitals. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    depth?: "none" | "one" | "two" | "three";
    icon?: IconName | null;
    current?: boolean;
    strong?: boolean;
    section?: boolean;
    expanded?: boolean | null;
    count?: number | null;
    ahead?: number;
    behind?: number;
    /** A dim path after the name, such as a worktree's folder. */
    path?: string;
    detail?: string;
    gone?: boolean;
    selected?: boolean;
    title?: string;
    actions?: Snippet;
    onclick?: () => void;
    ondblclick?: () => void;
    oncontextmenu?: (event: MouseEvent) => void;
    ontoggle?: () => void;
  }

  let {
    label,
    depth = "none",
    icon = null,
    current = false,
    strong = false,
    section = false,
    expanded = null,
    count = null,
    ahead = 0,
    behind = 0,
    path = "",
    detail = "",
    gone = false,
    selected = false,
    title,
    actions,
    onclick,
    ondblclick,
    oncontextmenu,
    ontoggle,
  }: Props = $props();

  const INDENT = { none: 0, one: 1, two: 2, three: 3 };
  const leaf = $derived(expanded === null);
  const indent = $derived(
    `calc(var(--sidebar-row-padding-left) + ${INDENT[depth]} * var(--sidebar-row-indent)` +
      `${leaf ? " + var(--sidebar-row-chevron)" : ""})`,
  );
</script>

<div
  class="sidebar-row"
  class:section
  class:selected
  class:has-actions={!!actions}
  role="treeitem"
  aria-selected={selected}
  aria-expanded={expanded ?? undefined}
  tabindex="-1"
  {title}
  style:padding-left={indent}
  onclick={() => (expanded === null ? onclick?.() : ontoggle?.())}
  ondblclick={() => ondblclick?.()}
  oncontextmenu={(event) => oncontextmenu?.(event)}
  onkeydown={() => undefined}
>
  <!-- A row without a chevron is indented by the chevron's width instead, so names line up with their group's. -->
  {#if !leaf}
    <span class="chevron"><Icon name={expanded ? "chevron-down" : "chevron-right"} size="compact" /></span>
  {/if}
  {#if icon}<span class="icon" class:current><Icon name={icon} size="normal" /></span>{/if}
  <span class="label" class:strong class:section-label={section} class:gone
    >{label}{#if path}<span class="path">{path}</span>{/if}</span
  >
  {#if count !== null}<span class="count">{count}</span>{/if}
  {#if ahead || behind}
    <span class="sync" title="{ahead} ahead, {behind} behind">
      {#if ahead}<span>{ahead}<Icon name="arrow-up" size="xsmall" /></span>{/if}
      {#if behind}<span>{behind}<Icon name="arrow-down" size="xsmall" /></span>{/if}
    </span>
  {/if}
  {#if detail}<span class="detail">{detail}</span>{/if}
  {#if actions}<span class="actions">{@render actions()}</span>{/if}
</div>

<style>
  .sidebar-row {
    display: flex;
    align-items: center;
    gap: var(--sidebar-row-gap);
    height: var(--sidebar-row-height);
    padding-right: var(--sidebar-row-padding-right);
    white-space: nowrap;
    outline: none;
  }

  .section {
    margin-top: var(--space-2);
  }

  .sidebar-row:hover {
    background: var(--hover);
  }

  /* Selected outweighs hover, as in the app: a selected row keeps its color under the pointer. */
  .sidebar-row.selected {
    background: var(--selected-inactive);
  }

  :global([role="tree"]:focus-within) .sidebar-row.selected {
    background: var(--selected);
  }

  .chevron {
    display: inline-flex;
    flex: none;
    width: var(--sidebar-row-chevron);
    color: var(--text-dim);
  }

  .icon {
    display: inline-flex;
    flex: none;
  }

  .icon.current {
    color: var(--accent);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .strong {
    font-weight: var(--font-weight-semibold);
  }

  .section-label {
    flex: 0 1 auto;
    font-size: var(--text-section-label-size);
    font-weight: var(--text-section-label-weight);
    letter-spacing: var(--text-section-label-letter-spacing);
    text-transform: var(--text-section-label-transform);
    color: var(--text-dim);
  }

  .path {
    margin-left: var(--space-3);
    color: var(--text-dim);
    font-size: var(--font-size-compact);
  }

  .gone {
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
  }

  .count,
  .detail {
    flex: none;
    font-size: var(--font-size-xsmall);
    color: var(--text-faint);
  }

  /* A stash's ref or a worktree's state (locked, prunable). */
  .detail {
    color: var(--text-dim);
  }

  .sync {
    display: inline-flex;
    flex: none;
    gap: var(--space-2);
    font-size: var(--font-size-xsmall);
    color: var(--text-dim);
  }

  .sync span {
    display: inline-flex;
    align-items: center;
  }

  .actions {
    display: none;
    flex: none;
    gap: 1px;
  }

  .sidebar-row:hover .actions,
  .selected .actions,
  .section .actions {
    display: inline-flex;
  }

  /* A section's buttons sit at the row's end; its title and count stay together at the start. */
  .section .actions {
    margin-left: auto;
  }

  /* Row buttons take the place of the detail (a stash's ref) while they show. */
  .has-actions:hover .detail,
  .has-actions.selected .detail {
    display: none;
  }
</style>
