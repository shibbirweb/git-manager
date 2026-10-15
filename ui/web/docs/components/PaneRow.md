# PaneRow

Views side by side in one panel, like split terminals: shares of the width, lines between, focus line.

```ts
import PaneRow from "@git-manager/ui/components/PaneRow.svelte";
```

Group: Layout. Also known as: Split panes.

## When to use

Use inside a positioned panel. With `onresize` a handle between two panes moves their split: it gets the left pane's
index, its new share of the whole width and the smallest share, for the app to store.

## Props

- `panes` (`{ key; share: number }[]`, required): Each pane and its share of the width.
- `focused` (`string | null`, default `null`): The focused pane: an accent line on top.
- `resizeLabel` (`string`, default `"Resize panes"`): Accessible name of the handles.
- `pane` (`Snippet<[P, index]>`, required): Draws a pane and its index.
- `onresize` (`(index: number, share: number, minShare: number) => void`): A handle moved a split.

## Example: Terminals

```svelte
<PaneRow panes={panes} focused={key} {pane} />
```

## Replaces in the app

- `.panes and .pane in src/lib/terminal/TerminalPanel.svelte`
