# Stack

Lays out children in a row or a column with a gap from the spacing tokens.

```ts
import Stack from "@git-manager/ui/components/Stack.svelte";
```

Group: Layout. Also known as: Flex, HStack, VStack, Box.

## When to use

Use for every layout instead of writing CSS: rows of buttons, label and value pairs, sections. Gaps are steps (xxs 2, xs
4, sm 6, md 8, mdPlus 10, lg 12, lgPlus 14, xl 16, xxl 24, xxxl 32 px), so a token change moves them all.

## Props

- `direction` (`"row" | "column"`, default `"column"`): Main axis.
- `gap` (`"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl"`, default `"md"`):
  Space between children.
- `padding` (`"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl"`, default
  `"none"`): Space inside the edges.
- `paddingX` (`"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl" | null`, default
  `null`): Space at the left and right, overriding `padding`.
- `paddingY` (`"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl" | null`, default
  `null`): Space at the top and bottom, overriding `padding`.
- `align` (`"start" | "center" | "end" | "stretch" | "baseline"`, default `"stretch"`): Cross-axis alignment.
- `justify` (`"start" | "center" | "end" | "between"`, default `"start"`): Main-axis distribution.
- `wrap` (`boolean`, default `false`): Wrap onto more lines.
- `grow` (`boolean`, default `false`): Take the free space of its own parent stack.
- `width` (`"auto" | "icon" | "xsmall" | "small" | "medium" | "large" | "xlarge"`, default `"auto"`): A set width so
  rows line up: icon 16, xsmall 70 (a hash), small 80, medium 90, large 120, xlarge 140.
- `scroll` (`"none" | "y" | "x" | "both"`, default `"none"`): Scrolls its content in its own box; pair with `grow`.
- `maxHeight` (`"none" | "xsmall" | "small" | "medium" | "large"`, default `"none"`): Grows up to 120, 160, 240 or 360
  px, then scrolls with `scroll="y"` (a short list in a dialog).
- `sticky` (`boolean`, default `false`): Stays at the top of the region scrolling under it, on the panel color with a
  line under it.
- `element` (`"div" | "span" | "section" | "header" | "footer" | "main" | "aside" | "nav" | "ul" | "li" | "form"`,
  default `"div"`): The HTML element; main, aside and nav mark a page's regions for screen readers; span fits inside a
  label, like a Checkbox's rich label.
- `role` (`"group" | "region" | "tabpanel" | "alert" | "status" | "presentation" | null`, default `null`): Its role for
  screen readers: tabpanel for the content under Tabs, alert for an error that appears.
- `label` (`string`): Accessible name, for sections and lists.
- `busy` (`boolean`, default `false`): Tells screen readers it is loading (aria-busy), like a panel refreshing its list.
- `responsive` (`boolean`, default `false`): Measures its width so what is inside can step aside with `hideAt` or
  `dotAt`; read once.
- `hideAt` (`"tiny" | "narrow" | "compact" | "medium" | null`, default `null`): In a responsive Toolbar or Stack under
  220, 320, 480 or 600 px, it goes with what it holds.
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

## Example: A row that drops parts when narrow

```svelte
<Stack direction="row" gap="xs" responsive>
  <Text truncate>{repoName}</Text>
  <Text hideAt="narrow">{branchName}</Text>
  <Stack direction="row" hideAt="tiny">{syncCounts}</Stack>
  <Badge count={changes} hideAt="tiny" />
</Stack>
```

## Replaces in the app

- `<div class="row">`
- `<div class="actions">`
- `<div class="toolbar">`
- `any flex container CSS`
- ``container: name / inline-size` with `@container` rules that hide parts`
