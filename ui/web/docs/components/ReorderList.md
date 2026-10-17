# ReorderList

Rows the user orders by dragging, like Interactive Rebase's commits.

```ts
import ReorderList from "@nibtree/ui/components/ReorderList.svelte";
```

Group: Navigation. Also known as: Sortable, Drag list.

## When to use

Use for short lists whose order matters. Up and Down move between rows; Alt+Up and Alt+Down move the focused row and the
focus follows it. Keys typed in a control inside a row stay with that control. Near the edges a drag scrolls the list;
Escape cancels it.

## Props

- `items` (`T[]`, required): The rows in order.
- `itemKey` (`(item: T) => string`, required): A row's id.
- `label` (`string`, required): Accessible name.
- `onreorder` (`(from: number, to: number) => void`, required): A row moved.
- `row` (`Snippet<[T, number]>`, required): Draws a row after its grip.
- `rowLabel` (`(item: T) => string`): What screen readers say for a row, before its move hint.
- `canDrop` (`(from: number, to: number) => boolean`, default `() => true`): Whether a dragged row may land there; a
  refused place shows no line.
- `dragBy` (`"grip" | "row"`, default `"grip"`): Drag by the grip only, or anywhere on the row but its controls.
- `maxHeight` (`"none" | "xsmall" | "small" | "medium" | "large"`, default `"none"`): Scrolls past 120, 160, 240 or 360
  px.
- `onkey` (`(event: KeyboardEvent, index: number) => void`): Keys on a focused row it does not use, such as a rebase
  action's letter.
- `heading` (`Snippet<[T, number]>`): Drawn above a row and not dragged, such as a group's title.
- `detail` (`Snippet<[T, number]>`): Drawn under a row inside its place, such as a message box.

## Example: Rebase

```svelte
<ReorderList label="Commits" {items} itemKey={(c) => c.id} {onreorder}>...
```

## Replaces in the app

- `.rows / .row-wrap / .grip in InteractiveRebaseDialog.svelte`

## Logic

- `logic/reorder.ts`
- `logic/treeDrag.ts`
