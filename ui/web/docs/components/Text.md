# Text

Text in a named text style from the design tokens, so words never need a class or color.

```ts
import Text from "@git-manager/ui/components/Text.svelte";
```

Group: Layout. Also known as: Typography, Label, Heading.

## When to use

Pick a `variant` (body, label, hint, caption, sectionLabel, panelTab, title, heading, display, paragraph, code,
codeSmall, badge, small, bodyStrong). `tone`, `size` and `weight` override the style only when a screen truly differs.
Use `truncate` for paths and names that may not fit.

## Props

- `variant` (`TextStyleName`, default `"body"`): The text style (see Foundations, Typography).
- `tone` (`"default" | "dim" | "faint" | "accent" | "danger" | "success" | "warning"`): Color from the theme; defaults
  to the style's tone.
- `size` (`"micro" | "tiny" | "xsmall" | "compact" | "small" | "codeSmall" | "ui" | "code" | "title" | "heading" |
  "display"`): Font size step, overriding the style's.
- `weight` (`"regular" | "medium" | "semibold" | "bold"`): Font weight, overriding the style's.
- `mono` (`boolean`, default `false`): Monospace, for hashes, paths and code.
- `truncate` (`boolean`, default `false`): One line with an ellipsis; give `title` the full text.
- `selectable` (`boolean`, default `false`): Lets the user select the text (the app turns selection off by default).
- `tabular` (`boolean`, default `false`): Digits of one width, for times, durations, sizes and counts.
- `wrap` (`"normal" | "anywhere" | "pre"`, default `"normal"`): Anywhere breaks long paths; pre keeps line breaks
  (output).
- `strike` (`boolean`, default `false`): Struck through, like a deleted file's name.
- `element` (`"span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "label" | "code"`, default `"span"`): The HTML element.
- `hideAt` (`"tiny" | "narrow" | "compact" | "medium" | null`, default `null`): In a responsive Toolbar or Stack under
  220, 320, 480 or 600 px, the words hide but screen readers still read them.
- `title` (`string`): Tooltip, e.g. the full text of a truncated path.
- `children` (`Snippet`, required): The text.

## Rules

- Prefer a variant over size and weight overrides, so a token change updates every screen.

## Example: Hint

```svelte
<Text variant="hint">Created from the current branch</Text>
```

## Example: Section label

```svelte
<Text variant="sectionLabel">Local branches</Text>
```

## Example: A path that may not fit

```svelte
<Text mono truncate title={path}>{path}</Text>
```

## Replaces in the app

- `<span class="dim">`
- `<span class="hint">`
- `<span class="mono">`
- `<span class="truncate">`
