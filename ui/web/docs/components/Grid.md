# Grid

A grid of equal columns: a fixed count, or as many as fit at a minimum width.

```ts
import Grid from "@git-manager/ui/components/Grid.svelte";
```

Group: Layout. Also known as: Grid.

## When to use

Use for cards, swatches and settings tiles. Use Stack for one row or one column.

## Props

- `columns` (`"auto" | "two" | "three" | "four" | "six"`, default `"auto"`): A named column count, or auto to fit as
  many as `minColumn` allows.
- `minColumn` (`"small" | "medium" | "large"`, default `"medium"`): Smallest column width for auto: 140, 180 or 240 px.
- `gap` (`"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl"`, default `"lg"`):
  Space between cells.
- `label` (`string`): Accessible name of the group.
- `children` (`Snippet`, required): The cells.

## Example: Cards

```svelte
<Grid>
  {#each repos as repo}<Card padded>...</Card>{/each}
</Grid>
```

## Replaces in the app

- `display: grid layouts written by hand`
