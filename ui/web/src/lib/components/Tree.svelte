<!-- A file-tree style list: folders open and close, rows indent by depth, and only rows in view are drawn. Click
     selects, double-click or Enter opens a file, arrow keys move like the Files panel. -->
<script lang="ts" generics="N extends TreeNode">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import { treeKey, treeRows, type TreeNode } from "../logic/treeModel";
  import { componentTokens } from "../styles/tokens";
  import Icon from "./Icon.svelte";
  import VirtualList from "./VirtualList.svelte";

  interface Props {
    nodes: N[];
    label: string;
    expanded?: string[];
    selected?: string | null;
    focused?: boolean;
    height?: "fill" | number;
    iconFor?: (node: N, open: boolean) => IconName | null;
    detail?: Snippet<[N]>;
    onopen?: (node: N) => void;
    oncontextmenu?: (node: N, event: MouseEvent) => void;
  }

  let {
    nodes,
    label,
    expanded = $bindable([]),
    selected = $bindable(null),
    focused = true,
    height = "fill",
    iconFor = (node: N) => (node.children ? "folder" : "file"),
    detail,
    onopen,
    oncontextmenu,
  }: Props = $props();

  const rows = $derived(treeRows(nodes, new Set(expanded)));
  const selectedIndex = $derived(rows.findIndex((row) => row.node.id === selected));

  function setOpen(id: string, open: boolean): void {
    expanded = open ? [...expanded.filter((entry) => entry !== id), id] : expanded.filter((entry) => entry !== id);
  }

  function activate(index: number): void {
    const row = rows[index];
    if (!row) {
      return;
    }
    if (row.isFolder) {
      setOpen(row.node.id, !row.expanded);
    } else {
      onopen?.(row.node);
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    const action = treeKey(rows, selectedIndex, event.key);
    if (!action) {
      return;
    }
    event.preventDefault();
    if (action.kind === "select") {
      selected = rows[action.index]?.node.id ?? selected;
    } else if (action.kind === "expand" || action.kind === "collapse") {
      setOpen(action.id, action.kind === "expand");
    } else {
      const row = rows.find((entry) => entry.node.id === action.id);
      if (row) {
        onopen?.(row.node);
      }
    }
  }
</script>

<div class="tree" role="tree" aria-label={label} tabindex="0" {onkeydown}>
  <VirtualList
    items={rows}
    rowHeight={componentTokens.tree.rowHeight}
    {label}
    keepInView={selectedIndex >= 0 ? selectedIndex : null}
    {height}
  >
    {#snippet row(entry, index)}
      {@const icon = iconFor(entry.node, entry.expanded)}
      <div
        class="row"
        class:selected={entry.node.id === selected}
        class:focused
        role="treeitem"
        aria-level={entry.depth + 1}
        aria-expanded={entry.isFolder ? entry.expanded : undefined}
        aria-selected={entry.node.id === selected}
        tabindex="-1"
        style:padding-left="calc(var(--tree-indent) + {entry.depth} * var(--tree-indent-step))"
        onclick={() => (selected = entry.node.id)}
        ondblclick={() => activate(index)}
        oncontextmenu={(event) => {
          selected = entry.node.id;
          oncontextmenu?.(entry.node, event);
        }}
        onkeydown={() => undefined}
      >
        <span class="chevron">
          {#if entry.isFolder}
            <Icon name={entry.expanded ? "chevron-down" : "chevron-right"} size={12} />
          {/if}
        </span>
        {#if icon}
          <Icon name={icon} size={14} />
        {/if}
        <span class="name">{entry.node.label}</span>
        {#if detail}
          <span class="detail">{@render detail(entry.node)}</span>
        {/if}
      </div>
    {/snippet}
  </VirtualList>
</div>

<style>
  .tree {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    outline: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--tree-gap);
    height: var(--tree-row-height);
    padding-right: var(--tree-padding-right);
    cursor: default;
    white-space: nowrap;
    outline: none;
  }

  .row:hover {
    background: var(--hover);
  }

  .row.selected {
    background: var(--selected-inactive);
  }

  .tree:focus-within .row.selected.focused {
    background: var(--selected);
  }

  .chevron {
    flex: none;
    display: flex;
    width: var(--tree-chevron);
    color: var(--text-dim);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail {
    flex: none;
    margin-left: auto;
    color: var(--text-faint);
    font-size: var(--font-size-small);
  }
</style>
