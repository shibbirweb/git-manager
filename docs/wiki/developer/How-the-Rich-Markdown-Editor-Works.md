# How the Rich Markdown Editor Works

In the Rich Editor view (mode `preview`), a Markdown file is shown as a rich text editor: you type in the rendered page, like Typora. This page explains how edits reach the file without reformatting it. The rest of the Markdown support is in [How the Markdown Editor Works](How-the-Markdown-Editor-Works.md); the user side is [Markdown Editor](../usage/Markdown-Editor.md).

## Why we need it

Many people like to edit the page as it looks. But a Markdown file is shared, and a rich editor that rewrote the whole file in its own style would turn every edit into a huge diff. So the rules are: **text you did not touch keeps its exact spelling**, and **a file the editor cannot keep exactly is not edited at all**.

## How it works

The editor is [TipTap](https://tiptap.dev) 3 (on ProseMirror) with `@tiptap/markdown`, which reads Markdown with marked. Its safety comes from an MIT-licensed core ported into `src/lib/markdown/rich/` with its tests. `RichMarkdownView.svelte` imports `richEditor.ts` on first use. The CodeMirror text editor stays the real file: it is hidden but alive, so save, undo, the unsaved dot and diffs keep working.

```mermaid
sequenceDiagram
  participant U as User
  participant TT as TipTap (ProseMirror)
  participant RE as RichMarkdownEditor
  participant RC as rich/ (ported core)
  participant CM as Text editor (CodeMirror)
  U->>TT: types in the page
  TT->>RE: document changed
  Note over RE: wait 300 ms for a pause (SYNC_DELAY_MS)
  RE->>RC: commitRichMarkdownSerialization
  RC->>RC: diff the editor's Markdown before and after, patch the diff onto the file's own text
  RC->>RC: re-parse the patched text; it must give the same Markdown
  RC-->>RE: the new body (else the editor's own Markdown)
  RE->>CM: onEdit(from, to, insert): one small edit, userEvent "input.rich"
```

### Opening a file: may it be edited?

`load` splits off front matter (`splitFrontMatter` in `richSync.ts`; it is kept as written and never shown), then asks `getMarkdownRichModeUnsupportedMessage` (`rich/markdown-rich-mode.ts`):

- Raw HTML, JSX or MDX is allowed only when a full round trip (`rich/markdown-round-trip.ts`: parse into a throwaway editor, write Markdown out) keeps every tag. `rich/raw-markdown-html.ts` first wraps HTML in placeholder tokens, so the editor shows it as a block it does not change.
- Reference-style links and footnotes are refused: the editor cannot keep them.
- More than 600 KB is refused (`rich/markdown-rich-size-limit.ts`).

A refused file is shown read-only with the reason, for example "This file has footnotes, which the rich editor cannot keep exactly. Edit it in the text editor."

After loading, `normalizeEmptyListItems` runs (so an empty list item does not split a paragraph), and the save starts from two copies: the body's own text and the editor's Markdown for it.

### Saving an edit

`commitRichMarkdownSerialization` (`rich/rich-markdown-serialization-commit.ts`):

1. No real change (the editor's Markdown equals the copy from loading): the original text is kept, byte for byte.
2. Otherwise `reconcileSerializedMarkdown` (`rich/rich-markdown-source-reconcile.ts`) diffs the two Markdown versions with diff-match-patch and applies that diff to the file's own text, so untouched text keeps its list markers, emphasis style, blank lines, CRLF line endings and trailing newline.
3. The patched text is parsed again by a throwaway editor with the same schema (`rich/rich-markdown-reconcile-serializer.ts`); it must give the same Markdown, or the editor's own Markdown is used instead. Files over 50 000 characters skip the patch.
4. When the patch fell back, `rich/rich-markdown-block-source.ts` still keeps whole untouched blocks.

`sourceEdit` (`richSync.ts`) turns the new text into one edit (the stretch between the common start and end, never splitting a surrogate pair), and `RichMarkdownView` hands it to the text editor.

### Changes from elsewhere

`RichMarkdownView` watches `docVersion`. When the text changes outside the rich editor (Revert, a reload, the hidden text editor), `setSource` loads it again, without adding to TipTap's history. `flush()` saves a pending edit at once: before Cmd+S, before switching views, on blur and when the view unmounts.

### Toolbar, keys and clicks

The toolbar's `onRichFormat(action)` runs a TipTap command (`RichMarkdownEditor.run`); Link (Cmd+K) sets or removes a link. Task boxes are TipTap's checkboxes. A click on a link places the caret; Cmd+click follows it (`classifyLink`).

### Images and diagrams

The editor on screen passes node views to the shared schema (`createRichMarkdownExtensions`); node views never change the Markdown:

- **Images** use `classifyImage`, like the preview: local files load through `read_image_data_url` once near the screen; remote ones are not loaded ("Remote images are not loaded").
- **Code blocks** with the language `mermaid` show the diagram under the code, drawn near the screen only, redrawn 400 ms after typing stops, and sanitized with `sanitizeSvg`.

## Where the code lives

| File | What it does |
| --- | --- |
| `ui/web/src/lib/components/MarkdownEditor.svelte` | Loading, read-only, Cmd+click links |
| `ui/web/src/lib/markdown/richEditor.ts`, `richNodeViews.ts` | TipTap, saving, actions, node views |
| `ui/web/src/lib/markdown/rich/` | The ported core (MIT, `LICENSE-ORCA`): schema, round trip, eligibility, reconcile, HTML placeholders |
| `ui/web/src/lib/markdown/richSync.ts` | Front matter split, `sourceEdit` |
| `src/lib/views/files/RichMarkdownView.svelte` | Link prompt, links, keys |
| `src/lib/views/files/FileView.svelte` | `applyRichEdit`, `richScroll`, mode switches |
| `vite.config.js` | TipTap entry points in `optimizeDeps` |

## Design decisions

**Patch the file, prove it, else fall back.** A diff of the editor's own Markdown keeps every untouched byte; the re-parse proof means a misplaced patch can never be written.

**Refuse over a wrong rewrite.** A file whose round trip loses anything is shown, not edited.

**A ported core, not our own.** Its round trip and reconcile code comes with hundreds of tests from a product that edits real files every day. Left out: math, editable `<details>` blocks (kept as raw HTML here), wiki links, superscript links, review notes and code colors.

**HTML blocks whole.** A CommonMark HTML block that starts with a block tag (`<table>`, `<div>`...) runs to the next blank line; it is kept as one raw block, as marked reads it (our addition to the ported code).

**Only the Rich Editor view is editable**, so the two sides of the split never fight over the cursor.

## Tests

- `ui/web/src/lib/markdown/rich/*.test.ts`: the ported tests for the round trip, eligibility, reconcile, HTML placeholders, tables, lists and paragraphs.
- `ui/web/src/lib/markdown/richEditor.test.ts` (happy-dom): every page of `docs/wiki`, `README.md`, `CHANGELOG.md` and messy samples (mixed markers, `__bold__`, setext headings, padded tables, `~~~` fences, CRLF, front matter, HTML, emoji). Each loads and saves with no change, and one typed character changes only that character; reference links and footnotes are refused; a ticked task box changes only `[ ]`.
- `ui/web/src/lib/markdown/richSync.test.ts`: `sourceEdit` and `splitFrontMatter`.

## Keeping this page in sync

- Update this page when the sync delay, the refusal rules or the ported core change; keep `LICENSE-ORCA` with the ported files.
- Retake `markdown-rich-editor.png` when the look changes.

## Bugs we fixed

Newer ones: [Rich Markdown Bugs](Rich-Markdown-Bugs-We-Fixed.md).

**Editing an existing file did not work well.**
- **The issue:** typing in Preview Only (now Rich Editor) on a file could reformat other text, turn the page read-only, or reload it after an edit.
- **Why it happened:** the old editor (Milkdown) wrote back block by block, which needed remark's block ranges and Milkdown's blocks to line up one to one; often they did not (raw HTML, lists, nested blocks).
- **The fix and why we chose it:** TipTap with the ported core. It decides per file whether editing is safe, patches each edit onto the file's own text and proves the result by a re-parse. Tested on every Markdown file here.

**A README with an HTML table could not be edited.**
- **The issue:** our README (a screenshot table in HTML) opened read-only.
- **Why it happened:** HTML was wrapped line by line, so the table's indented `<td>` lines were read as indented code and the round trip lost them.
- **The fix and why we chose it:** `raw-markdown-html.ts` keeps a CommonMark block-tag HTML block whole, to the next blank line, as marked does.

**Rich editor diagrams were not sanitized** (Milkdown version, kept): the code block view now passes mermaid's SVG through `sanitizeSvg`, as the preview does.
