# TreeRow

One row of a Tree: chevron, icon, name or rename field, decoration and detail.

```ts
import TreeRow from "@git-manager/ui/components/TreeRow.svelte";
```

Group: Navigation.

## When to use

Tree draws these from its nodes; use TreeRow alone only for a custom tree.

## Props

- `row` (`TreeRow<N>`, required): The node with its depth and open state.
- `icon` (`IconName | null`, required): The row's icon.
- `selected` (`boolean`, required): In the selection.
- `focused` (`boolean`, required): The focused row while the tree has the focus.
- `decoration` (`TreeDecoration | null`, required): Tone, strike and badge.
- `renaming` (`boolean`, required): Shows the rename field.
- `dropTarget` (`boolean`, required): Marked as the drop target.
- `detail` (`Snippet<[N]>`): Dim content at the end.
- `onclick` (`(event: MouseEvent) => void`, required): Clicked.
- `ondblclick` (`() => void`, required): Double-clicked.
- `oncontextmenu` (`(event: MouseEvent) => void`, required): Right-clicked.
- `onrename` (`(name: string | null) => void`, required): Rename ended; null when cancelled.
- `onpointerdown` (`(event: PointerEvent) => void`, required): Pressed: the Tree may start a drag from it.

## Example: Inside Tree

```svelte
<!-- Tree renders TreeRow for every visible node. -->
```

## Replaces in the app

- `<div class="row"> in FileExplorer.svelte`
