# SplitGrid

The editor area split into groups placed by fractions, with lines (or rounded gaps) between them.

```ts
import SplitGrid from "@git-manager/ui/components/SplitGrid.svelte";
```

Group: Layout. Also known as: Editor groups, Split view.

## When to use

Use for Window > Split Right / Split Down. The app's split tree gives the rects; draw groups in `group`.

## Props

- `groups` (`{ id; rect: { x; y; width; height } }[]`, required): Each group and its fractions of the area.
- `splitters` (`{ id; direction: right|down; rect; ratio }[]`, default `[]`): Where the splits are.
- `look` (`"flat" | "rounded"`, default `"flat"`): Lines between groups, or rounded panels apart.
- `focused` (`string | null`, default `null`): The focused group's id.
- `group` (`Snippet<[G, index]>`, required): Draws a group (its tabs and editor) and its index.
- `splitter` (`Snippet<[GridSplitter]>`): Draws a split's ResizeHandle (inPanel).
- `onfocus` (`(id: string) => void`): A group got focus or a click.

## Example: Two groups

```svelte
<SplitGrid {groups} {splitters} {group} {splitter} />
```

## Replaces in the app

- `.editor-area, .editor-group and .group-splitter in src/lib/views/Workspace.svelte`

## Logic

- `logic/splitGrid.ts`
