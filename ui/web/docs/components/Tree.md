# Tree

A file-tree list: folders open and close, rows indent by depth, and only rows in view are drawn.

```ts
import Tree from "@git-manager/ui/components/Tree.svelte";
```

Group: Navigation. Also known as: Tree view, File tree.

## When to use

Use for folders and files or any nested list. Give folders a `children` array (empty when nothing is in them). Keys work
like the Files panel; double-click or Enter opens a file.

## Props

- `nodes` (`N extends TreeNode ({ id: string; label: string; children?: N[] })[]`, required): The top level.
- `label` (`string`, required): Accessible name.
- `expanded` (`string[]`, default `[]`, bindable): Ids of open folders.
- `selected` (`string | null`, default `null`, bindable): The selected (focused) row's id.
- `multiple` (`boolean`, default `false`): Cmd/Ctrl-click adds, Shift-click selects a range.
- `selection` (`string[]`, default `[]`, bindable): Selected ids when `multiple`.
- `focused` (`boolean`, default `true`): Show the selection in the focus color while the tree has the focus.
- `height` (`"fill" | "small" | "medium" | "large"`, default `"fill"`): Fill the parent, or 160, 240 or 360 px.
- `renaming` (`string | null`, default `null`, bindable): The row being renamed in place.
- `reveal` (`"nearest" | "center"`, default `"nearest"`): How the selected row comes into view: at the nearest edge, or
  in the middle when it was out of view (a located file).
- `draggable` (`boolean`, default `false`): Rows can be dragged onto folders with the pointer: a ghost follows, Option
  copies, a hovered closed folder opens, the list scrolls near its edges, Escape cancels.
- `dropRoot` (`boolean`, default `false`): A drop into the top folder: the whole list is outlined.
- `iconFor` (`(node: N, open: boolean) => IconName | null`, default `(node) => (node.children ? "folder" : "file")`):
  Icon per row.
- `decorate` (`(node: N) => TreeDecoration | null`, default `() => null`): A row's tone, strike, badge, cut, ignored,
  root (a workspace folder's header), repo (accent icon) and tag (LFS).
- `detail` (`Snippet<[N]>`): Dim content at the end of a row.
- `onopen` (`(node: N) => void`): A file was opened (double-click or Enter).
- `onrename` (`(node: N, name: string) => void`): A rename was confirmed with Enter.
- `ondrop` (`(ids: string[], target: N | null, mode: "move" | "copy") => void`): Rows were dropped onto a folder, or
  onto the top level (null); never into themselves or where they already are.
- `oncontextmenu` (`(node: N, event: MouseEvent) => void`): Right-click on a row, for its Menu.

## Example: Files

```svelte
<Tree label="Files" {nodes} bind:expanded bind:selected onopen={openFile} />
```

## Replaces in the app

- `the rows of FileExplorer.svelte`

## Logic

- `logic/treeModel.ts`
- `logic/treeDrag.ts`
- `logic/treeDragger.svelte.ts`
- `logic/virtualWindow.ts`
