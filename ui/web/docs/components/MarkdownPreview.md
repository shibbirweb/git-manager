# MarkdownPreview

The live preview of a Markdown file: highlighted code, mermaid diagrams, local images and task boxes.

```ts
import MarkdownPreview from "@git-manager/ui/components/MarkdownPreview.svelte";
```

Group: Editor. Also known as: Markdown, Preview, Rendered Markdown.

## When to use

Use beside or instead of a Markdown file's source editor. It renders after a pause in typing and only while visible. The
app opens links (`onlink`) and edits task lines (`ontoggletask`); use MarkdownView for a short, static text such as
release notes.

## Props

- `label` (`string`, required): Accessible name.
- `docVersion` (`number`, required): Bumped on every edit; the source is read only when a render runs.
- `getSource` (`() => string`, required): The Markdown text now.
- `view` (`EditorView | null`, required): The source editor, to scroll with it.
- `visible` (`boolean`, required): On screen: renders wait while hidden.
- `syncScroll` (`boolean`, required): The preview and `view` scroll together.
- `initialLine` (`number`, required): The 0-based source line shown at the top when it opens.
- `highlighting` (`boolean`, required): Highlight code blocks.
- `loadParser` (`(extension: string) => Promise<Parser | null>`, required): The grammar for a code block.
- `linkContext` (`() => LinkContext`, required): Where links and images resolve from.
- `loadImage` (`(filePath: string) => Promise<string>`, required): The URL of a local image.
- `isDark` (`() => boolean`, required): The page is dark (diagram colors).
- `onlink` (`(target: LinkTarget) => void`, required): A link to open: external, a file, or blocked.
- `ontoggletask` (`(lineIndex: number) => void`, required): A task box was clicked: edit its source line.
- `onleave` (`(topLine: number) => void`): The preview closes, with the source line at its top.
- `onkeydown` (`(event: KeyboardEvent) => void`): A key in the page, such as Cmd+S.

## Rules

- Diagrams draw in a frame page: call configureDiagrams (markdown/mermaid) once with its URL.

## Example: Beside the editor

```svelte
<MarkdownPreview label="Preview" {docVersion} getSource={() => text} {view} visible syncScroll
  initialLine={0} highlighting {loadParser} {linkContext} {loadImage} {isDark} onlink={open}
  ontoggletask={toggle} />
```

## Replaces in the app

- `src/lib/views/files/MarkdownPreview.svelte's rendering, scroll sync and clicks`
