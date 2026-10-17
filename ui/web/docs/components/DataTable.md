# DataTable

A table of many rows with a header, like the log: named column widths, a lead column, selection.

```ts
import DataTable from "@nibtree/ui/components/DataTable.svelte";
```

Group: Navigation. Also known as: Table, Data table, Grid.

## When to use

Use for long lists with columns (commits, remotes, shortcuts). Only rows in view are drawn. Draw cells with the `cell`
snippet, or let the table show the row's value under each column id. The keys are List's (arrows, Page keys, Home, End,
Enter). `focus()` takes the focus and `reveal(key, place)` scrolls a row the app selected into view, to the middle with
`center` (a commit opened from blame).

## Props

- `columns` (`DataColumn[] ({ id; label; width: fill|xsmall|small|side|medium|large; tone?; mono?; small? })`,
  required): The columns; widths are 82, 110, 150 or 220 px, or the rest of the row.
- `rows` (`T[]`, required): All rows.
- `rowKey` (`(row: T) => string`, required): A row's id.
- `label` (`string`, required): Accessible name.
- `rowHeight` (`"compact" | "normal" | "relaxed" | "comfortable"`, default `"relaxed"`): Every row's height.
- `height` (`"fill" | "small" | "medium" | "large"`, default `"fill"`): Fill the parent, or 160, 240 or 360 px.
- `selected` (`string | null`, default `null`, bindable): The selected row's id.
- `leadWidth` (`number`, default `0`): The lead column's width, such as the graph's.
- `strong` (`(row: T) => boolean`, default `() => false`): Rows whose first column is bold (HEAD).
- `field` (`HTMLInputElement | null`, default `null`): A filter field above it: Down or Enter there moves the focus in.
- `lead` (`Snippet<[T]>`): A column before the others, such as CommitGraph.
- `cell` (`Snippet<[T, DataColumn]>`): Draws a cell.
- `empty` (`Snippet`): Shown under the header when there are no rows, such as an EmptyState.
- `onopen` (`(row: T) => void`): Double-click or Enter.
- `oncontextmenu` (`(row: T, event: MouseEvent) => void`): Right-click, for its Menu.
- `onnearend` (`() => void`): Scrolled near the end: load the next page (once per row count).

## Example: Commits

```svelte
<DataTable label="Commits" {columns} rows={commits} rowKey={(c) => c.id} />
```

## Replaces in the app

- `the .columns header and .row list of LogView.svelte`
- `RemotesDialog and McpToolsDialog lists`

## Logic

- `logic/table.ts`
- `logic/listWiring.svelte.ts`
