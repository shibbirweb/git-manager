# SectionTitle

A small heading over a group of rows, with a count and buttons at its end.

```ts
import SectionTitle from "$ui/components/SectionTitle.svelte";
```

Group: Layout. Also known as: Heading, List header, Group header.

## When to use

Use over lists inside tabs, panels and dialogs. bar: a full bar with a line (Changes tab); list: inside a tab; caption:
quiet (commit details files); caps: small capitals (AI folders); day: dates (Local History); divided: normal weight with
a line (MCP groups).

## Props

- `title` (`string`, required): The heading.
- `titleMatches` (`[number, number][]`, default `[]`): Ranges [start, end) of the title a search found, in the warning
  tint (Settings search).
- `variant` (`"bar" | "list" | "caption" | "caps" | "day" | "divided" | "group" | "band" | "picker"`, default `"list"`):
  The place it heads; band is a tinted strip.
- `count` (`number | null`, default `null`): A count after the title.
- `heading` (`2 | 3 | 4 | null`, default `null`): Makes the title a heading of this level for screen readers.
- `actions` (`Snippet`): Buttons at the end.

## Example: Changes

```svelte
<SectionTitle variant="bar" title="Staged" count={3} />
```

## Replaces in the app

- `.section-title in BranchCompareTab, ChangesTab, WorktreeDiffTab`
- `.files-header in CommitDetails, .day in LocalHistoryDialog, .folder-heading in AiPanel`
- `.group-head in McpToolsDialog`
