<!-- A short table in a bordered box, like the conflicts dialog's files: a sticky header row and 28 px rows that
     can be selected; with `multiple`, Cmd or Ctrl adds a row and Shift a range. Columns take named widths (or the
     rest). For long lists use DataTable, which draws only the rows in view. -->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { presetVar } from "../logic/presets";
  import type { DataColumn } from "../logic/table";
  import { modifiersOf, selectRow } from "../logic/treeSelect";

  interface Props {
    columns: DataColumn[];
    rows: T[];
    rowKey: (row: T) => string;
    label: string;
    selected?: string | null;
    multiple?: boolean;
    selection?: string[];
    cell: Snippet<[T, DataColumn]>;
    onselect?: (row: T) => void;
    onopen?: (row: T) => void;
  }

  let {
    columns,
    rows,
    rowKey,
    label,
    selected = $bindable(null),
    multiple = false,
    selection = $bindable([]),
    cell,
    onselect,
    onopen,
  }: Props = $props();

  let anchor = $state<string | null>(null);

  function isSelected(key: string): boolean {
    return multiple ? selection.includes(key) : selected === key;
  }

  function pick(row: T, event: MouseEvent) {
    const key = rowKey(row);
    if (multiple) {
      const next = selectRow(rows.map(rowKey), { ids: selection, anchor: anchor ?? selected }, key, modifiersOf(event));
      selection = next.ids;
      anchor = next.anchor;
    }
    selected = key;
    onselect?.(row);
  }

  const template = $derived(
    columns
      .map((column) => (column.width === "fill" ? "minmax(0, 1fr)" : presetVar("tableColumn", column.width)))
      .join(" "),
  );
</script>

<div
  class="table"
  role="grid"
  aria-label={label}
  aria-multiselectable={multiple || undefined}
  tabindex="0"
  style:--columns={template}
>
  <div class="row header" role="row">
    {#each columns as column (column.id)}<span role="columnheader">{column.label}</span>{/each}
  </div>
  {#each rows as row (rowKey(row))}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="row item"
      class:selected={isSelected(rowKey(row))}
      role="row"
      tabindex="-1"
      aria-selected={isSelected(rowKey(row))}
      onclick={(event) => pick(row, event)}
      ondblclick={() => onopen?.(row)}
    >
      {#each columns as column (column.id)}<span class="cell" role="gridcell">{@render cell(row, column)}</span>{/each}
    </div>
  {/each}
</div>

<style>
  .table {
    flex: 1;
    min-width: 0;
    overflow: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    outline: none;
  }

  .row {
    display: grid;
    grid-template-columns: var(--columns);
    align-items: center;
    gap: var(--table-gap);
    height: var(--table-row-height);
    padding: 0 var(--table-padding-x);
  }

  .header {
    position: sticky;
    top: 0;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-semibold);
  }

  .item {
    cursor: default;
  }

  .item:hover {
    background: var(--hover);
  }

  .item.selected {
    background: var(--selected);
  }

  .cell {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
</style>
