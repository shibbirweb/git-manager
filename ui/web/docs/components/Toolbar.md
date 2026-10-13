# Toolbar

A row of controls along a view's edge: a tab's top bar, a panel's bar, the editors' bars, footers.

```ts
import Toolbar from "$ui/components/Toolbar.svelte";
```

Group: Layout. Also known as: Toolbar, Button group, Action bar, Footer.

## When to use

Pick the variant for the place: tab (git tabs, 34 px), panel (Git Console, Shelf), editor (diff), log, filter (a search
row), merge and footer (merge editor), dialog (a dialog's filter bar) or pane (a pane inside a dialog). Put controls in
`children` and what belongs at the far end in `end`.

## Props

- `variant` (`"tab" | "panel" | "editor" | "file" | "compact" | "log" | "filter" | "merge" | "footer" | "dialog" |
  "pane" | "head" | "popup" | "rail" | "conflict" | "strip" | "search" | "dialog-footer"`, default `"tab"`): Where it
  sits: sets its height, padding, gap and edge line.
- `label` (`string`, required): Accessible name.
- `children` (`Snippet`, required): Controls at the start.
- `placement` (`"top" | "bottom"`, default `"top"`): Bottom: under its view, its line on top (File toolbar: Bottom).
- `end` (`Snippet`): Controls pushed to the far end.
- `responsive` (`boolean`, default `false`): Measures its width, so Text, Badge and Divider inside can step aside with
  `hideAt` or `dotAt` when it is narrow (the file bar).

## Rules

- Separate groups with a vertical Divider; it takes the toolbar's length and spacing.
- For narrow bars, set `responsive` and give the least needed words `hideAt`, never a width of your own.

## Example: A history tab

```svelte
<Toolbar label="File history">
  <Icon name="history" size="normal" />
  <Text>History of cart.ts</Text>
  {#snippet end()}<Text tone="dim" size="small">12 commits</Text>{/snippet}
</Toolbar>
```

## Replaces in the app

- `.toolbar in FileHistoryTab, LineHistoryTab, ReflogTab, BranchCompareTab, ChangesTab, WorktreeDiffTab`
- `.toolbar in GitConsoleView, ShelfPanel, DiffView, LogView, AiPanel, ScriptsPanel`
- `.toolbar and .footer in MergeEditor; .toolbar in McpToolsDialog, ShortcutsDialog, LocalHistoryDialog`

## Logic

- `logic/barSize.svelte.ts`
- `logic/breakpoints.ts`
