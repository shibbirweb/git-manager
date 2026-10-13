<!-- One row of a Tree: chevron, icon and name (or the rename field), a decoration (tone, strike, cut, ignored,
     section root, tag, badge) and the detail snippet. The Tree passes the state and handles the events. -->
<script lang="ts" generics="N extends TreeNode">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import type { TreeDecoration, TreeNode, TreeRow as Row } from "../logic/treeModel";
  import { toneColor } from "../logic/scale";
  import Icon from "./Icon.svelte";
  import Tag from "./Tag.svelte";

  interface Props {
    row: Row<N>;
    icon: IconName | null;
    selected: boolean;
    focused: boolean;
    decoration: TreeDecoration | null;
    renaming: boolean;
    dropTarget: boolean;
    detail?: Snippet<[N]>;
    onclick: (event: MouseEvent) => void;
    ondblclick: () => void;
    oncontextmenu: (event: MouseEvent) => void;
    onrename: (name: string | null) => void;
    onpointerdown: (event: PointerEvent) => void;
  }

  let {
    row,
    icon,
    selected,
    focused,
    decoration,
    renaming,
    dropTarget,
    detail,
    onclick,
    ondblclick,
    oncontextmenu,
    onrename,
    onpointerdown,
  }: Props = $props();

  function focusAndSelect(input: HTMLInputElement): void {
    input.focus();
    const dot = row.isFolder ? -1 : input.value.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  }
</script>

<div
  class="row"
  class:selected
  class:focused
  class:drop-target={dropTarget}
  class:cut={decoration?.cut}
  class:ignored={decoration?.ignored}
  class:folder-root={decoration?.root}
  class:repo={decoration?.repo}
  role="treeitem"
  aria-level={row.depth + 1}
  aria-expanded={row.isFolder ? row.expanded : undefined}
  aria-selected={selected}
  tabindex="-1"
  data-tree-id={row.node.id}
  style:padding-left="calc(var(--tree-indent) + {row.depth} * var(--tree-indent-step))"
  {onclick}
  {ondblclick}
  {oncontextmenu}
  {onpointerdown}
  onkeydown={() => undefined}
>
  <span class="chevron">
    {#if row.isFolder}
      <Icon name={row.expanded ? "chevron-down" : "chevron-right"} size="compact" />
    {/if}
  </span>
  {#if icon}
    <span class="icon"><Icon name={icon} size="normal" /></span>
  {/if}
  {#if renaming}
    <input
      class="rename"
      value={row.node.label}
      aria-label="New name"
      use:focusAndSelect
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          onrename(event.currentTarget.value.trim() || null);
        } else if (event.key === "Escape") {
          onrename(null);
        }
      }}
      onblur={(event) => onrename(event.currentTarget.value.trim() || null)}
    />
  {:else}
    <span
      class="name"
      class:strike={decoration?.strike}
      style:color={decoration?.tone ? toneColor(decoration.tone) : null}>{row.node.label}</span
    >
  {/if}
  {#if decoration?.tag}<Tag variant="outline" size="small">{decoration.tag}</Tag>{/if}
  {#if decoration?.badge}
    <span class="badge" style:color={decoration.tone ? toneColor(decoration.tone) : null}>{decoration.badge}</span>
  {/if}
  {#if detail}
    <span class="detail">{@render detail(row.node)}</span>
  {/if}
</div>

<style>
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

  :global([role="tree"]:focus-within) .row.selected.focused {
    background: var(--selected);
  }

  /* The folder a drop goes into, and everything shown inside it. */
  .drop-target {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .icon {
    flex: none;
    display: flex;
    color: var(--text-dim);
  }

  .repo .icon {
    color: var(--accent);
  }

  .cut .name,
  .cut .icon {
    opacity: 0.5;
  }

  .ignored .name,
  .ignored .icon {
    color: var(--text-faint);
  }

  .folder-root .name {
    font-size: var(--font-size-xsmall);
    font-weight: var(--font-weight-bold);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
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

  .strike {
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
  }

  .badge {
    flex: none;
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-compact);
    font-weight: var(--font-weight-bold);
  }

  .detail {
    flex: none;
    margin-left: auto;
    color: var(--text-faint);
    font-size: var(--font-size-small);
  }

  .rename {
    flex: 1;
    min-width: 0;
    height: calc(var(--tree-row-height) - var(--space-2));
    padding: 0 var(--space-2);
    border: 1px solid var(--accent);
    border-radius: var(--radius-small);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    outline: none;
  }
</style>
