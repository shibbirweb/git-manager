# PaneRow

Views side by side in one panel, like split terminals: shares of the width, lines between, focus line.

```ts
import PaneRow from "@git-manager/ui/components/PaneRow.svelte";
```

Group: Layout. Also known as: Split panes.

## When to use

Use inside a positioned panel; put ResizeHandles between panes in `pane` when they can be resized.

## Props

- `panes` (`{ key; share: number }[]`, required): Each pane and its share of the width.
- `focused` (`string | null`, default `null`): The focused pane: an accent line on top.
- `pane` (`Snippet<[P, index]>`, required): Draws a pane and its index.

## Example: Terminals

```svelte
<PaneRow panes={panes} focused={key} {pane} />
```

## Replaces in the app

- `.panes and .pane in src/lib/terminal/TerminalPanel.svelte`
