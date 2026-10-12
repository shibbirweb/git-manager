# CommitGraph

One row of the log's commit graph: lane lines in the palette's lane colors and the commit node.

```ts
import CommitGraph from "$ui/components/CommitGraph.svelte";
```

Group: Editor. Also known as: Graph.

## When to use

Use as DataTable's `lead` in the log. The app computes lanes and edges; this draws one row.

## Props

- `row` (`GraphRowData ({ lane; color; edges: [kind, from, to, color]... })`, required): The row's lanes.
- `laneCount` (`number`, required): Lanes in the whole log, for the column width.
- `rowHeight` (`"compact" | "normal" | "relaxed" | "comfortable"`, default `"relaxed"`): The table's row height: 22, 24,
  26 or 28 px.
- `head` (`boolean`, default `false`): The checked-out commit: a halo around the node.
- `merge` (`boolean`, default `false`): A merge commit: a ring instead of a dot.
- `nodeOnly` (`boolean`, default `false`): Only the node, while the log is filtered.

## Example: In the log

```svelte
<CommitGraph row={graph[index]} {laneCount} head={isHead} />
```

## Replaces in the app

- `src/lib/log/GraphCell.svelte`

## Logic

- `logic/graphModel.ts`
