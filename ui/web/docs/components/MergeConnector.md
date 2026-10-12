# MergeConnector

The column between two merge panes: a ribbon per chunk and its apply and ignore buttons.

```ts
import MergeConnector from "$ui/components/MergeConnector.svelte";
```

Group: Editor. Also known as: Ribbon, Connector.

## When to use

MergeView measures the panes and draws this between them; use it alone only for a custom merge layout.

## Props

- `ribbons` (`ConnectorRibbon[] ({ index; kind; aTop; aBottom; bTop; bBottom })`, required): Each chunk's lines on both
  sides, in pixels from the column's top.
- `side` (`"left" | "right"`, required): Which pane the buttons apply from.
- `onapply` (`(index: number) => void`): Apply a chunk.
- `onignore` (`(index: number) => void`): Ignore a chunk.

## Example: Between panes

```svelte
<MergeConnector side="left" {ribbons} onapply={apply} />
```

## Replaces in the app

- `the .connector SVG of src/lib/merge/MergeEditor.svelte`

## Logic

- `logic/mergeGeometry.ts`
