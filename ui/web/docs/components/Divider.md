# Divider

A 1px line between groups: horizontal by default, vertical in toolbars.

```ts
import Divider from "@git-manager/ui/components/Divider.svelte";
```

Group: Layout. Also known as: Separator.

## When to use

Use between groups of buttons or sections. Strong is the menu separator color; soft is the row border.

## Props

- `direction` (`"horizontal" | "vertical"`, default `"horizontal"`): Line direction.
- `strong` (`boolean`, default `true`): The stronger border color.
- `hideAt` (`"tiny" | "narrow" | "compact" | "medium" | null`, default `null`): In a responsive Toolbar or Stack under
  220, 320, 480 or 600 px, the line goes.

## Example: In a toolbar

```svelte
<Divider direction="vertical" />
```

## Replaces in the app

- `<div class="separator">`
- `<div class="divider">`
