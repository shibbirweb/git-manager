<!-- A file-tree style list: folders open and close, rows indent by depth, and only rows in view are drawn. Click
     selects (Cmd and Shift add with `multiple`), double-click or Enter opens a file, arrow keys move like the Files
     panel. Rows can carry a decoration, be renamed in place, and be dragged onto folders. -->
<script lang="ts" generics="N extends TreeNode">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import type { ViewHeight } from "../logic/presets";
  import { treeKey, treeRows, type TreeDecoration, type TreeNode } from "../logic/treeModel";
  import { modifiersOf, selectRow } from "../logic/treeSelect";
  import TreeRow from "./TreeRow.svelte";
  import VirtualList from "./VirtualList.svelte";

  interface Props {
    nodes: N[];
    label: string;
    expanded?: string[];
    selected?: string | null;
    multiple?: boolean;
    selection?: string[];
    focused?: boolean;
    height?: ViewHeight;
    renaming?: string | null;
    draggable?: boolean;
    /** A drop into the tree's top folder: the whole list is outlined. */
    dropRoot?: boolean;
    iconFor?: (node: N, open: boolean) => IconName | null;
    decorate?: (node: N) => TreeDecoration | null;
    detail?: Snippet<[N]>;
    onopen?: (node: N) => void;
    onrename?: (node: N, name: string) => void;
    ondrop?: (ids: string[], target: N) => void;
    oncontextmenu?: (node: N, event: MouseEvent) => void;
  }

  let {
    nodes,
    label,
    expanded = $bindable([]),
    selected = $bindable(null),
    multiple = false,
    selection = $bindable([]),
    focused = true,
    height = "fill",
    renaming = $bindable(null),
    draggable = false,
    dropRoot = false,
    iconFor = (node: N) => (node.children ? "folder" : "file"),
    decorate = () => null,
    detail,
    onopen,
    onrename,
    ondrop,
    oncontextmenu,
  }: Props = $props();

  const rows = $derived(treeRows(nodes, new Set(expanded)));
  const order = $derived(rows.map((row) => row.node.id));
  const selectedIndex = $derived(rows.findIndex((row) => row.node.id === selected));
  let anchor: string | null = null;
  let dropOn = $state<string | null>(null);

  const isSelected = (id: string) => (multiple ? selection.includes(id) : id === selected);

  function setOpen(id: string, open: boolean): void {
    expanded = open ? [...expanded.filter((entry) => entry !== id), id] : expanded.filter((entry) => entry !== id);
  }

  function click(id: string, event: MouseEvent): void {
    selected = id;
    if (multiple) {
      const next = selectRow(order, { ids: selection, anchor }, id, modifiersOf(event));
      selection = next.ids;
      anchor = next.anchor;
    }
  }

  function activate(index: number): void {
    const row = rows[index];
    if (row?.isFolder) {
      setOpen(row.node.id, !row.expanded);
    } else if (row) {
      onopen?.(row.node);
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    if (renaming !== null) {
      return;
    }
    const action = treeKey(rows, selectedIndex, event.key);
    if (!action) {
      return;
    }
    event.preventDefault();
    if (action.kind === "select") {
      selected = rows[action.index]?.node.id ?? selected;
      selection = multiple && selected ? [selected] : selection;
    } else if (action.kind === "expand" || action.kind === "collapse") {
      setOpen(action.id, action.kind === "expand");
    } else {
      const row = rows.find((entry) => entry.node.id === action.id);
      if (row) {
        onopen?.(row.node);
      }
    }
  }

  function dragged(event: DragEvent, id: string): void {
    const ids = multiple && selection.includes(id) ? selection : [id];
    event.dataTransfer?.setData("application/x-gm-tree", JSON.stringify(ids));
  }

  function dropped(event: DragEvent, node: N): void {
    dropOn = null;
    const raw = event.dataTransfer?.getData("application/x-gm-tree");
    if (raw && node.children) {
      event.preventDefault();
      ondrop?.(JSON.parse(raw) as string[], node);
    }
  }
</script>

<div
  class="tree"
  class:drop-root={dropRoot}
  role="tree"
  aria-label={label}
  aria-multiselectable={multiple}
  tabindex="0"
  {onkeydown}
>
  <VirtualList items={rows} {label} keepInView={selectedIndex >= 0 ? selectedIndex : null} {height}>
    {#snippet row(entry, index)}
      <TreeRow
        row={entry}
        icon={iconFor(entry.node, entry.expanded)}
        selected={isSelected(entry.node.id)}
        focused={focused && entry.node.id === selected}
        decoration={decorate(entry.node)}
        renaming={renaming === entry.node.id}
        {draggable}
        dropTarget={dropOn === entry.node.id}
        {detail}
        onclick={(event) => click(entry.node.id, event)}
        ondblclick={() => activate(index)}
        oncontextmenu={(event) => {
          if (!isSelected(entry.node.id)) {
            click(entry.node.id, new MouseEvent("click"));
          }
          oncontextmenu?.(entry.node, event);
        }}
        onrename={(name) => {
          renaming = null;
          if (name && name !== entry.node.label) {
            onrename?.(entry.node, name);
          }
        }}
        ondragstart={(event) => dragged(event, entry.node.id)}
        ondragover={(event) => {
          if (draggable && entry.isFolder) {
            event.preventDefault();
            dropOn = entry.node.id;
          }
        }}
        ondrop={(event) => dropped(event, entry.node)}
      />
    {/snippet}
  </VirtualList>
</div>

<style>
  .tree.drop-root {
    box-shadow: inset 0 0 0 1px var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .tree {
    padding: var(--tree-padding-y) 0;
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    outline: none;
  }
</style>
