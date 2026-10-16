# Tag

A small label beside a name, like "primary" or "folder" in the AI panel.

```ts
import Tag from "@git-manager/ui/components/Tag.svelte";
```

Group: Feedback. Also known as: Tag, Chip, Label.

## When to use

Use for a word of status next to a name. Use Badge for numbers.

## Props

- `variant` (`"fill" | "outline"`, default `"fill"`): Outline: a bordered kind label, such as submodule.
- `tone` (`"neutral" | "accent" | "danger" | "success" | "warning"`, default `"neutral"`): Color of the label.
- `size` (`"normal" | "small"`, default `"normal"`): Small for tight rows, such as a file's LFS mark.
- `title` (`string`): Tooltip.
- `children` (`Snippet`, required): The word.

## Example: Main worktree

```svelte
<Tag>primary</Tag>
```

## Replaces in the app

- `<span class="tag">primary</span>`
- `<span class="pill">`
