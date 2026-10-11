# Grid

A grid of equal columns: a fixed count, or as many as fit at a minimum width.

```ts
import Grid from "$ui/components/Grid.svelte";
```

Group: Layout. Also known as: Grid.

## When to use

Use for cards, swatches and settings tiles. Use Stack for one row or one column.

## Props

- `columns` (`number | "auto"`, default `"auto"`): A column count, or auto to fit as many as `minColumn` allows.
- `minColumn` (`number`, default `grid.minColumn (180)`): Smallest column width in px for auto.
- `gap` (`"none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl"`, default `"lg"`): Space between cells.
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
