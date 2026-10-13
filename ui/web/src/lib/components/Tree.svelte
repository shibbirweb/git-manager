<!-- A file-tree style list: folders open and close, rows indent by depth, and only rows in view are drawn. Click
     selects (Cmd and Shift add with `multiple`), double-click or Enter opens a file, arrow keys move like the Files
     panel. Rows can carry a decoration, be renamed in place, and be dragged onto folders with the pointer (HTML5
     drag never reaches a Tauri page): Option copies, a hovered folder opens, the list scrolls near its edges. -->
<script lang="ts" generics="N extends TreeNode">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import type { ViewHeight } from "../logic/presets";
  import { dragText, treeDropTarget, treeParents, type DropMode } from "../logic/treeDrag";
  import { TreeDragger } from "../logic/treeDragger.svelte";
  import { treeKey, treeRows, type TreeDecoration, type TreeNode } from "../logic/treeModel";
  import { modifiersOf, selectRow } from "../logic/treeSelect";
  import DragGhost from "./DragGhost.svelte";
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
    reveal?: "nearest" | "center";
    draggable?: boolean;
    /** A drop into the tree's top folder: the whole list is outlined. */
    dropRoot?: boolean;
    iconFor?: (node: N, open: boolean) => IconName | null;
    decorate?: (node: N) => TreeDecoration | null;
    detail?: Snippet<[N]>;
    onopen?: (node: N) => void;
    onrename?: (node: N, name: string) => void;
    ondrop?: (ids: string[], target: N | null, mode: DropMode) => void;
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
    reveal = "nearest",
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
  let treeEl = $state<HTMLDivElement | null>(null);
  let scroller = $state<HTMLDivElement | null>(null);
  const parents = $derived(treeParents(nodes));
  const byId = $derived(new Map(rows.map((row) => [row.node.id, row])));

  const dragger = new TreeDragger({
    root: () => treeEl,
    scroller: () => scroller,
    idsFor: (id) => (multiple && selection.includes(id) ? selection : [id]),
    target: (hit, ids, mode) => treeDropTarget(hit, ids, mode, parents, (id) => byId.get(id)?.isFolder ?? false),
    isClosedFolder: (id) => byId.get(id)?.isFolder === true && !expanded.includes(id),
    open: (id) => setOpen(id, true),
    drop: (ids, target, mode) => ondrop?.(ids, target === null ? null : (findNode(target) ?? null), mode),
  });
  const drag = $derived(dragger.drag);
  $effect(() => dragger.cancel);

  function findNode(id: string, list: readonly N[] = nodes): N | undefined {
    for (const node of list) {
      const found = node.id === id ? node : node.children ? findNode(id, node.children as N[]) : undefined;
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  function labelOf(id: string): string {
    return byId.get(id)?.node.label ?? findNode(id)?.label ?? id;
  }

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
</script>

<div
  bind:this={treeEl}
  class="tree"
  class:drop-root={dropRoot || drag?.target === null}
  role="tree"
  aria-label={label}
  aria-multiselectable={multiple}
  tabindex="0"
  {onkeydown}
>
  <VirtualList
    bind:element={scroller}
    items={rows}
    {label}
    keepInView={selectedIndex >= 0 ? selectedIndex : null}
    {reveal}
    {height}
  >
    {#snippet row(entry, index)}
      <TreeRow
        row={entry}
        icon={iconFor(entry.node, entry.expanded)}
        selected={isSelected(entry.node.id)}
        focused={focused && entry.node.id === selected}
        decoration={decorate(entry.node)}
        renaming={renaming === entry.node.id}
        dropTarget={drag !== null && drag.target === entry.node.id}
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
        onpointerdown={(event) => {
          if (draggable && renaming === null) {
            dragger.press(event, entry.node.id);
          }
        }}
      />
    {/snippet}
  </VirtualList>
</div>
{#if drag}
  <DragGhost text={dragText(drag.ids.map(labelOf), drag.mode)} x={drag.x} y={drag.y} />
{/if}

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
