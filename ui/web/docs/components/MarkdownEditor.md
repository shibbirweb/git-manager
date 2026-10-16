# MarkdownEditor

A Markdown file edited like a document (TipTap): edits go into the source text block by block.

```ts
import MarkdownEditor from "@git-manager/ui/components/MarkdownEditor.svelte";
```

Group: Editor. Also known as: Rich editor, WYSIWYG, Markdown.

## When to use

Use for a rich, Typora-style view of a Markdown file. The source text stays the truth: apply `onedit` to it and bump
`docVersion` when it changes elsewhere. Call the exported `format`, `toggleLink` and `flush` from a toolbar or before
saving.

## Props

- `label` (`string`, required): Accessible name.
- `docVersion` (`number`, required): Bumped on every change of the source text.
- `getSource` (`() => string`, required): The Markdown text now.
- `initialScroll` (`number`, required): The scroll position to start at.
- `linkContext` (`() => LinkContext`, required): Where links and images resolve from.
- `loadImage` (`(filePath: string) => Promise<string>`, required): The URL of a local image.
- `isDark` (`() => boolean`, required): The page is dark (diagram colors).
- `onedit` (`(edit: SourceEdit) => void`, required): An edit made here, to apply to the source text.
- `onlink` (`(target: LinkTarget) => void`, required): A Cmd+clicked link to open: external, a file, or blocked.
- `onleave` (`(scrollTop: number) => void`): It closes, with its scroll position.
- `onkeydown` (`(event: KeyboardEvent) => void`): A key in the page, such as Cmd+S.

## Rules

- Diagrams draw in a frame page: call configureDiagrams (markdown/mermaid) once with its URL.

## Example: A README

```svelte
<MarkdownEditor bind:this={editor} label="README.md" {docVersion} getSource={() => text}
  initialScroll={0} {linkContext} {loadImage} {isDark} onedit={apply} onlink={open} />
```

## Replaces in the app

- `src/lib/views/files/RichMarkdownView.svelte's editor lifecycle and link clicks`
