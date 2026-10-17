# RefLabel

A ref chip in the log: HEAD, local and remote branches, tags, bisect marks and a +N chip.

```ts
import RefLabel from "@nibtree/ui/components/RefLabel.svelte";
```

Group: Feedback.

## When to use

Use in log rows and commit details. Give the full list to the +N chip's `title`.

## Props

- `kind` (`"head" | "local" | "remote" | "tag" | "more" | "bisect-bad" | "bisect-good" | "bisect-skip" |
  "bisect-current"`, required): The ref's kind and color.
- `label` (`string`, required): The ref's name.
- `title` (`string`): Tooltip; defaults to the label.
- `icon` (`IconName | null`, default `null`): A small icon before the name.

## Example: Branches

```svelte
<RefLabel kind="head" label="main" />
<RefLabel kind="tag" label="v1.0" />
```

## Replaces in the app

- `<span class="ref ref-...">, <span class="ref bisect-..."> in LogView.svelte`
