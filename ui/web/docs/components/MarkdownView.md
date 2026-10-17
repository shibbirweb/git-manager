# MarkdownView

Rendered Markdown in the app's preview typography: headings, lists, tasks, tables, code, quotes.

```ts
import MarkdownView from "@nibtree/ui/components/MarkdownView.svelte";
```

Group: Editor. Also known as: Markdown, Preview, Prose.

## When to use

Use for Markdown previews and read-only notes. The library renders with markdown-it and sanitizes the HTML; the app
passes its own engine (highlighting, mermaid, local images) as `render`.

## Props

- `source` (`string`, required): The Markdown text.
- `label` (`string`, required): Accessible name.
- `render` (`(source: string) => string`): Turns the source into safe HTML instead of the built-in one.
- `variant` (`"document" | "notes"`, default `"document"`): A document's typography, or release notes' (smaller).
- `ontoggle` (`(line: number) => void`): A task box was clicked: edit that source line (0-based).
- `onlink` (`(href: string) => void`): A link was clicked; without it the browser follows the link.

## Rules

- `render` must return sanitized HTML.
- Task boxes never change on their own: toggle the source line in `ontoggle` and pass the new source.

## Example: A README

```svelte
<MarkdownView label="README.md" source={text} />
```

## Replaces in the app

- `src/lib/views/files/MarkdownPreview.svelte`
- `the .md-body styles the app kept in src/lib/markdown`

## Logic

- `logic/markdownTasks.ts`
