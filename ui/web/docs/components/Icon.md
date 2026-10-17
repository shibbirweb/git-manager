# Icon

A stroke icon on a 24px grid in the current text color. The preview lists every icon name.

```ts
import Icon from "@nibtree/ui/components/Icon.svelte";
```

Group: Actions.

## When to use

Use inside buttons, rows and labels. Color it with `tone`; never hard-code a color.

## Props

- `name` (`IconName`, required): Which icon; the preview lists them all.
- `size` (`IconSize`, default `"large"`): A named size: xxsmall 9, xsmall 10, small 11, compact 12, medium 13, normal
  14, regular 15, large 16, xlarge 18, activity 19, xxlarge 20, emphasis 22, huge 24, logo 26, giant 28, display 34 px.
- `stroke` (`"thin" | "light" | "normal" | "bold"`, default `"normal"`): Line weight 1.5, 1.8, 2 or 2.6: light for
  activity bars, thin for big empty-state art, bold for small marks such as a check.
- `tone` (`"inherit" | "default" | "dim" | "faint" | "accent" | "danger" | "success" | "warning"`, default `"inherit"`):
  Color from the theme; inherit takes the parent's text color.

## Example: In a label

```svelte
<span class="row"><Icon name="branch" size={14} /> main</span>
```

## Replaces in the app

- `<Icon name="..." /> from src/lib/ui/Icon.svelte (same props)`
