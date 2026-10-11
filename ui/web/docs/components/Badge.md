# Badge

A count in a small pill, like the changes count on the activity bar; "99+" above `max`.

```ts
import Badge from "$ui/components/Badge.svelte";
```

Group: Feedback. Also known as: Badge, Counter.

## When to use

Use for counts on buttons and tabs. Use Tag for words.

## Props

- `count` (`number`, required): The number.
- `max` (`number`, default `99`): Above it, shows `max+`.
- `tone` (`"accent" | "danger" | "neutral"`, default `"accent"`): Color: accent for counts, danger for conflicts.
- `label` (`string`): What the count means, e.g. `3 changes`; defaults to the number.

## Example: Changes

```svelte
<Badge count={changes} label="{changes} changes" />
```

## Replaces in the app

- `<span class="badge">3</span>`
