# Mark

A tiny box with one to three letters that names a tool, such as an AI agent.

```ts
import Mark from "@nibtree/ui/components/Mark.svelte";
```

Group: Feedback. Also known as: Agent mark, Monogram.

## When to use

Use before an agent's row (normal) or its usage in the status bar (small).

## Props

- `text` (`string`, required): The letters.
- `size` (`"normal" | "small"`, default `"normal"`): Row or status bar size.
- `title` (`string`): The tool's full name.

## Example: Claude Code

```svelte
<Mark text="CC" title="Claude Code" />
```

## Replaces in the app

- `.badge in AiPanel agent rows`
- `.mark in AiUsage`
