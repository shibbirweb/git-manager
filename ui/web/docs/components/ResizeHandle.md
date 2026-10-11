# ResizeHandle

A drag handle on a panel's edge: a line that becomes an accent bar on hover; keys and double-click.

```ts
import ResizeHandle from "$ui/components/ResizeHandle.svelte";
```

Group: Layout. Also known as: Resizable handle.

## When to use

Use beside a panel whose size the parent keeps. SplitPane wraps it for the common two-pane case.

## Props

- `size` (`number`, required): The panel's current width, or height for the bottom side.
- `side` (`"left" | "right" | "bottom"`, required): Where the panel is, relative to the handle.
- `min` (`number`, required): Smallest size.
- `max` (`number`, required): Largest size.
- `defaultSize` (`number`, required): Size after a double-click.
- `label` (`string`, required): Accessible name.
- `onresize` (`(size: number) => void`, required): The new size while dragging or on a key.
- `oncommit` (`(size: number) => void`): Called once when it ends, to save the size.

## Example: Left panel

```svelte
<ResizeHandle {size} side="left" min={160} max={600} defaultSize={260} label="Resize Files"
  onresize={(next) => (size = next)} oncommit={save} />
```

## Replaces in the app

- `src/lib/ui/ResizeHandle.svelte (panel becomes side, onResize becomes onresize)`

## Logic

- `logic/resize.ts`
