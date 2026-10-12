# ReorderList

Rows the user orders by dragging their grip, like Interactive Rebase's commits.

```ts
import ReorderList from "$ui/components/ReorderList.svelte";
```

Group: Navigation. Also known as: Sortable, Drag list.

## When to use

Use for short lists whose order matters. Alt+Up and Alt+Down move the focused row.

## Props

- `items` (`T[]`, required): The rows in order.
- `itemKey` (`(item: T) => string`, required): A row's id.
- `label` (`string`, required): Accessible name.
- `onreorder` (`(from: number, to: number) => void`, required): A row moved.
- `row` (`Snippet<[T, number]>`, required): Draws a row after its grip.

## Example: Rebase

```svelte
<ReorderList label="Commits" {items} itemKey={(c) => c.id} {onreorder}>...
```

## Replaces in the app

- `.rows / .row-wrap / .grip in InteractiveRebaseDialog.svelte`

## Logic

- `logic/reorder.ts`
