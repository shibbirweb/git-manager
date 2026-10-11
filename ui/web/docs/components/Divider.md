# Divider

A 1px line between groups: horizontal by default, vertical in toolbars.

```ts
import Divider from "$ui/components/Divider.svelte";
```

Group: Layout. Also known as: Separator.

## When to use

Use between groups of buttons or sections. Strong is the menu separator color; soft is the row border.

## Props

- `direction` (`"horizontal" | "vertical"`, default `"horizontal"`): Line direction.
- `strong` (`boolean`, default `true`): The stronger border color.

## Example: In a toolbar

```svelte
<Divider direction="vertical" />
```

## Replaces in the app

- `<div class="separator">`
- `<div class="divider">`
