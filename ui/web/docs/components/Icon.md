# Icon

A stroke icon on a 24px grid in the current text color. The preview lists every icon name.

```ts
import Icon from "$ui/components/Icon.svelte";
```

Group: Actions.

## When to use

Use inside buttons, rows and labels. Color it with `tone`; never hard-code a color.

## Props

- `name` (`IconName`, required): Which icon; the preview lists them all.
- `size` (`number`, default `16`): Width and height in px.
- `strokeWidth` (`number`, default `2`): Line width on the 24px grid.
- `tone` (`"inherit" | "default" | "dim" | "faint" | "accent" | "danger" | "success" | "warning"`, default `"inherit"`):
  Color from the theme; inherit takes the parent's text color.

## Example: In a label

```svelte
<span class="row"><Icon name="branch" size={14} /> main</span>
```

## Replaces in the app

- `<Icon name="..." /> from src/lib/ui/Icon.svelte (same props)`
