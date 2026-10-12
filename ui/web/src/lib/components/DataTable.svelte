<!-- A table of many rows with a header, like the log: columns with named widths (or the rest of the row), an
     optional leading column such as the commit graph, a selected row, arrow keys and Enter. Only rows in view are
     drawn. -->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { RowHeight, ViewHeight } from "../logic/presets";
  import { presetVar } from "../logic/presets";
  import { toneColor } from "../logic/scale";
  import { cellText, type DataColumn } from "../logic/table";
  import VirtualList from "./VirtualList.svelte";

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
    lead?: Snippet<[T]>;
    cell?: Snippet<[T, DataColumn]>;
    onopen?: (row: T) => void;
    oncontextmenu?: (row: T, event: MouseEvent) => void;
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
    lead,
    cell,
    onopen,
    oncontextmenu,
  }: Props = $props();

  const selectedIndex = $derived(rows.findIndex((row) => rowKey(row) === selected));

  function widthOf(column: DataColumn): string | null {
    return column.width === "fill" ? null : presetVar("tableColumn", column.width);
  }

  function onkeydown(event: KeyboardEvent): void {
    if (!rows.length) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = Math.min(rows.length - 1, Math.max(0, (selectedIndex < 0 ? -step : selectedIndex) + step));
      selected = rowKey(rows[next]);
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      onopen?.(rows[selectedIndex]);
    }
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
  <div class="body" role="listbox" aria-label={label} tabindex="0" {onkeydown}>
    <VirtualList items={rows} {rowHeight} {label} {height} keepInView={selectedIndex >= 0 ? selectedIndex : null}>
      {#snippet row(item)}
        <div
          class="row"
          class:selected={rowKey(item) === selected}
          class:strong={strong(item)}
          role="option"
          tabindex="-1"
          aria-selected={rowKey(item) === selected}
          onmousedown={() => (selected = rowKey(item))}
          ondblclick={() => onopen?.(item)}
          oncontextmenu={(event) => {
            selected = rowKey(item);
            oncontextmenu?.(item, event);
          }}
          onkeydown={() => undefined}
        >
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
    </VirtualList>
  </div>
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

  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    outline: none;
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

  .body:focus-within .row.selected {
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
