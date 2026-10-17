# VirtualList

A long list that draws only the rows in view, for thousands of rows of one fixed height.

```ts
import VirtualList from "@nibtree/ui/components/VirtualList.svelte";
```

Group: Navigation. Also known as: Virtual list, Scroll area.

## When to use

Use for long lists such as commits or search results. `keepInView` scrolls a selected row into view.

## Props

- `items` (`T[]`, required): All rows.
- `rowHeight` (`"compact" | "normal" | "comfortable"`, default `"normal"`): Every row's height: 22, 24 or 28 px.
- `label` (`string`, required): Accessible name.
- `keepInView` (`number | null`, default `null`): Index to scroll into view when it changes.
- `reveal` (`"nearest" | "center"`, default `"nearest"`): Bring that row to the nearest edge, or to the middle when it
  is out of view.
- `element` (`HTMLDivElement | null`, default `null`, bindable): The scrolling element, to scroll it from outside.
- `height` (`"fill" | "small" | "medium" | "large"`, default `"fill"`): Fill the parent, or 160, 240 or 360 px.
- `row` (`Snippet<[T, number]>`, required): Draws one row from its item and index.

## Example: Commits

```svelte
<VirtualList items={commits} label="Commits">
  {#snippet row(commit)}<Text truncate>{commit.subject}</Text>{/snippet}
</VirtualList>
```

## Replaces in the app

- `<div class="spacer-rows"> windowing in FileExplorer, LogView and search results`

## Logic

- `logic/virtualWindow.ts`
