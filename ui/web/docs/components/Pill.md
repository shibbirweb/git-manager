# Pill

A rounded word that tells a state: unsaved, modified, merging, write.

```ts
import Pill from "@git-manager/ui/components/Pill.svelte";
```

Group: Feedback. Also known as: Status badge, Label.

## When to use

Use next to a name. `strong` for an operation in progress (a repository that is merging).

## Props

- `tone` (`"neutral" | "accent" | "success" | "warning" | "danger" | "selected"`, default `"neutral"`): The tint;
  selected reads on a selected row.
- `strong` (`boolean`, default `false`): Bold words.
- `variant` (`"fill" | "outline" | "border"`, default `"fill"`): Outline: a small bordered flag, such as a setting's
  memory cost; border: a fill with a border.
- `title` (`string`): A tooltip.
- `dotAt` (`"tiny" | "narrow" | "compact" | "medium" | null`, default `null`): In a responsive Toolbar or Stack under
  220, 320, 480 or 600 px, only a dot in its color shows; the word stays in its name (the file bar).
- `children` (`Snippet`, required): The word.

## Example: Unsaved

```svelte
<Pill tone="warning">Unsaved</Pill>
```

## Example: File bar

```svelte
<Pill tone="accent" title="Modified" dotAt="compact">Modified</Pill>
```

## Replaces in the app

- `.badge in FileView, McpToolsDialog, ColorThemePicker`
- `.op-badge in RepoSection, CleanRepoList`
