# Badge

A count in a small pill, like the changes count on the activity bar; "99+" above `max`.

```ts
import Badge from "@nibtree/ui/components/Badge.svelte";
```

Group: Feedback. Also known as: Badge, Counter.

## When to use

Use for counts on buttons and tabs. Use Tag for words.

## Props

- `count` (`number`, required): The number.
- `max` (`number`, default `99`): Above it, shows `max+`.
- `size` (`"small" | "normal" | "large" | "corner"`, default `"normal"`): 14px (status bar), 16px, 17px with 11px text
  (group counts), or pinned to a button's corner.
- `tone` (`"accent" | "danger" | "warning" | "neutral" | "quiet"`, default `"accent"`): Color: accent for counts, danger
  for conflicts, warning for unread notices, quiet for a group's count.
- `label` (`string`): What the count means, e.g. `3 changes`; defaults to the number.
- `dotAt` (`"tiny" | "narrow" | "compact" | "medium" | null`, default `null`): In a responsive Toolbar or Stack under
  220, 320, 480 or 600 px, only a dot shows; the count stays in its name.
- `hideAt` (`"tiny" | "narrow" | "compact" | "medium" | null`, default `null`): In a responsive Toolbar or Stack under
  220, 320, 480 or 600 px, it goes.

## Example: Changes

```svelte
<Badge count={changes} label="{changes} changes" />
```

## Replaces in the app

- `<span class="badge">3</span>`
