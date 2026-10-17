# Table

A short table in a bordered box: a sticky header and 28 px rows that can be selected.

```ts
import Table from "@nibtree/ui/components/Table.svelte";
```

Group: Navigation. Also known as: Grid, Simple table.

## When to use

Use for small tables in dialogs, such as the conflicts. For long lists use DataTable.

## Props

- `columns` (`DataColumn[] ({ id; label; width: fill|xsmall|small|side|medium|large })`, required): The columns.
- `rows` (`T[]`, required): The rows.
- `rowKey` (`(row: T) => string`, required): A row's id.
- `label` (`string`, required): Accessible name.
- `selected` (`string | null`, default `null`, bindable): The selected row's id (the last one picked).
- `multiple` (`boolean`, default `false`): Cmd or Ctrl click adds a row, Shift click a range.
- `selection` (`string[]`, default `[]`, bindable): The selected rows' ids, with `multiple`.
- `cell` (`Snippet<[T, DataColumn]>`, required): Draws a cell.
- `onselect` (`(row: T) => void`): A row was pressed.
- `onopen` (`(row: T) => void`): A row was double-clicked.

## Example: Conflicts

```svelte
<Table label="Conflicts" {columns} rows={files} rowKey={(f) => f.path} {cell} />
```

## Replaces in the app

- `.table in src/lib/merge/ConflictsDialog.svelte`

## Logic

- `logic/table.ts`
- `logic/treeSelect.ts`
