<!-- A table of many rows with a header, like the log: columns with named widths (or the rest of the row), an
     optional leading column such as the commit graph, and a List under the header that owns the keys, the
     selection and the scrolling. Only rows in view are drawn. -->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { RevealPlace } from "../logic/listWiring.svelte";
  import type { RowHeight, ViewHeight } from "../logic/presets";
  import { presetVar } from "../logic/presets";
  import { toneColor } from "../logic/scale";
  import { cellText, type DataColumn } from "../logic/table";
  import List from "./List.svelte";

  interface Props {
    columns: DataColumn[];
    rows: T[];
    rowKey: (row: T) => string;
    label: string;
    rowHeight?: RowHeight;
    height?: ViewHeight;
    selected?: string | null;
    leadWidth?: number;
    strong?: (row: T) => boolean;
    field?: HTMLInputElement | null;
    lead?: Snippet<[T]>;
    cell?: Snippet<[T, DataColumn]>;
    empty?: Snippet;
    onopen?: (row: T) => void;
    oncontextmenu?: (row: T, event: MouseEvent) => void;
    onnearend?: () => void;
  }

  let {
    columns,
    rows,
    rowKey,
    label,
    rowHeight = "relaxed",
    height = "fill",
    selected = $bindable(null),
    leadWidth = 0,
    strong = () => false,
    field = null,
    lead,
    cell,
    empty,
    onopen,
    oncontextmenu,
    onnearend,
  }: Props = $props();

  let list = $state<{ focus: () => void; reveal: (key: string, place?: RevealPlace) => Promise<void> } | null>(null);

  /** Takes the focus, such as after a click that should leave the keys with the table. */
  export function focus(): void {
    list?.focus();
  }

  /** Scrolls a row into view after the app selected it: the least needed, or to the middle. */
  export function reveal(key: string, place: RevealPlace = "nearest"): Promise<void> {
    return list?.reveal(key, place) ?? Promise.resolve();
  }

  function widthOf(column: DataColumn): string | null {
    return column.width === "fill" ? null : presetVar("tableColumn", column.width);
  }
</script>

<div class="table" style:--lead-width="{leadWidth}px">
  <div class="columns" role="presentation">
    {#each columns as column, index (column.id)}
      <div
        class="col"
        class:fill={column.width === "fill"}
        class:first-fill={index === 0 && column.width === "fill"}
        style:width={widthOf(column)}
      >
        {column.label}
      </div>
    {/each}
  </div>
  <List
    bind:this={list}
    items={rows}
    itemKey={rowKey}
    {label}
    {height}
    virtual={rowHeight}
    bind:selected
    {field}
    {empty}
    onactivate={onopen}
    oncontextmenu={(event, row) => oncontextmenu?.(row, event)}
    {onnearend}
  >
    {#snippet row(item, state)}
      <div class="row" class:selected={state.selected} class:strong={strong(item)}>
        {#if lead}
          <div class="lead">{@render lead(item)}</div>
        {/if}
        {#each columns as column, index (column.id)}
          <div
            class="col"
            class:fill={column.width === "fill"}
            class:first-fill={index === 0 && column.width === "fill" && lead}
            class:mono={column.mono}
            class:small={column.small}
            style:width={widthOf(column)}
            style:color={column.tone ? toneColor(column.tone) : null}
          >
            {#if cell}{@render cell(item, column)}{:else}{cellText(item, column)}{/if}
          </div>
        {/each}
      </div>
    {/snippet}
  </List>
</div>

<style>
  .table {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: 0;
  }

  .columns {
    flex: none;
    display: flex;
    align-items: center;
    height: var(--data-table-header-height);
    padding-right: var(--data-table-header-padding-right);
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-size: var(--font-size-compact);
  }

  .columns .first-fill {
    padding-left: calc(var(--lead-width) + var(--space-2));
  }

  .row {
    --row-bg: var(--panel);
    display: flex;
    align-items: center;
    height: 100%;
    padding-right: var(--data-table-row-padding-right);
    background: var(--row-bg);
    white-space: nowrap;
  }

  .row:hover {
    --row-bg: var(--hover);
  }

  .row.selected {
    --row-bg: var(--selected-inactive);
  }

  .table:focus-within .row.selected {
    --row-bg: var(--selected);
  }

  .lead {
    flex: none;
    width: var(--lead-width);
    height: 100%;
    overflow: hidden;
  }

  .col {
    flex: none;
    min-width: 0;
    padding-left: var(--data-table-cell-padding-left);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fill {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .row .first-fill {
    padding-left: var(--space-2);
  }

  .strong .first-fill {
    font-weight: var(--font-weight-semibold);
  }

  .mono {
    font-family: var(--font-mono);
  }

  .small {
    font-size: var(--font-size-compact);
  }
</style>
