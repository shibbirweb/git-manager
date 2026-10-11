# VirtualList

A long list that draws only the rows in view, for thousands of rows of one fixed height.

```ts
import VirtualList from "$ui/components/VirtualList.svelte";
```

Group: Navigation. Also known as: Virtual list, Scroll area.

## When to use

Use for long lists such as commits or search results. `keepInView` scrolls a selected row into view.

## Props

- `items` (`T[]`, required): All rows.
- `rowHeight` (`number`, required): Height of every row in px.
- `label` (`string`, required): Accessible name.
- `overscan` (`number`, default `8`): Rows drawn beyond the view on each side.
- `keepInView` (`number | null`, default `null`): Index to scroll into view when it changes.
- `height` (`"fill" | number`, default `"fill"`): Fill the parent (which needs a height) or a height in px.
- `row` (`Snippet<[T, number]>`, required): Draws one row from its item and index.

## Example: Commits

```svelte
<VirtualList items={commits} rowHeight={24} label="Commits">
  {#snippet row(commit)}<Text truncate>{commit.subject}</Text>{/snippet}
</VirtualList>
```

## Replaces in the app

- `<div class="spacer-rows"> windowing in FileExplorer, LogView and search results`

## Logic

- `logic/virtualWindow.ts`
