# Tag

A small label beside a name, like "primary" or "folder" in the AI panel.

```ts
import Tag from "$ui/components/Tag.svelte";
```

Group: Feedback. Also known as: Tag, Chip, Label.

## When to use

Use for a word of status next to a name. Use Badge for numbers.

## Props

- `tone` (`"neutral" | "accent" | "danger" | "success" | "warning"`, default `"neutral"`): Color of the label.
- `title` (`string`): Tooltip.
- `children` (`Snippet`, required): The word.

## Example: Main worktree

```svelte
<Tag>primary</Tag>
```

## Replaces in the app

- `<span class="tag">primary</span>`
- `<span class="pill">`
