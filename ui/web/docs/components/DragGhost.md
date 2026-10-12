# DragGhost

The label that follows the pointer while files are dragged.

```ts
import DragGhost from "$ui/components/DragGhost.svelte";
```

Group: Feedback. Also known as: Drag preview.

## When to use

Show it while dragging rows; `x` and `y` are the pointer's position.

## Props

- `text` (`string`, required): Such as 3 files.
- `x` (`number`, required): The pointer's x.
- `y` (`number`, required): The pointer's y.

## Example: Files

```svelte
<DragGhost text="3 files" x={pointer.x} y={pointer.y} />
```

## Replaces in the app

- `.drag-ghost in src/lib/views/files/FileExplorer.svelte`
