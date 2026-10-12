# Card

A bordered box that groups rows, like a worktree card in the AI panel.

```ts
import Card from "$ui/components/Card.svelte";
```

Group: Layout. Also known as: Card, Panel.

## When to use

Use to group related rows on a panel. Rows inside bring their own padding unless `padded` is set.

## Props

- `label` (`string`): Accessible name of the group.
- `padded` (`boolean`, default `false`): Adds 12px padding for free content.
- `selected` (`boolean`, default `false`): The chosen card: an accent border.
- `dim` (`boolean`, default `false`): Faded, for something gone or paused, like a missing worktree.
- `children` (`Snippet`, required): The rows.

## Example: Worktree

```svelte
<Card label="main worktree" padded>...</Card>
```

## Replaces in the app

- `<div class="card">`
