# Stack

Lays out children in a row or a column with a gap from the spacing tokens.

```ts
import Stack from "$ui/components/Stack.svelte";
```

Group: Layout. Also known as: Flex, HStack, VStack, Box.

## When to use

Use for every layout instead of writing CSS: rows of buttons, label and value pairs, sections. Gaps are steps (xxs 2, xs
4, sm 6, md 8, lg 12, xl 16, xxl 24 px), so a token change moves them all.

## Props

- `direction` (`"row" | "column"`, default `"column"`): Main axis.
- `gap` (`"none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl"`, default `"md"`): Space between children.
- `padding` (`"none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl"`, default `"none"`): Space inside the
  edges.
- `paddingX` (`"none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl" | null`, default `null`): Space at the
  left and right, overriding `padding`.
- `paddingY` (`"none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl" | null`, default `null`): Space at the
  top and bottom, overriding `padding`.
- `align` (`"start" | "center" | "end" | "stretch" | "baseline"`, default `"stretch"`): Cross-axis alignment.
- `justify` (`"start" | "center" | "end" | "between"`, default `"start"`): Main-axis distribution.
- `wrap` (`boolean`, default `false`): Wrap onto more lines.
- `grow` (`boolean`, default `false`): Take the free space of its own parent stack.
- `scroll` (`"none" | "y" | "x" | "both"`, default `"none"`): Scrolls its content in its own box; pair with `grow`.
- `element` (`"div" | "section" | "header" | "footer" | "ul" | "li" | "form"`, default `"div"`): The HTML element.
- `label` (`string`): Accessible name, for sections and lists.
- `children` (`Snippet`, required): The content.

## Rules

- Do not add CSS for layout; combine Stacks. Gaps and padding come only from the named steps.
- There is no margin: space between items is the parent's gap, space inside is padding.

## Example: Dialog actions

```svelte
<Stack direction="row" justify="end" gap="md">
  <Button>Cancel</Button>
  <Button variant="primary">Save</Button>
</Stack>
```

## Replaces in the app

- `<div class="row">`
- `<div class="actions">`
- `<div class="toolbar">`
- `any flex container CSS`
