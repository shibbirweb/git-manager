# Tree

A file-tree list: folders open and close, rows indent by depth, and only rows in view are drawn.

```ts
import Tree from "$ui/components/Tree.svelte";
```

Group: Navigation. Also known as: Tree view, File tree.

## When to use

Use for folders and files or any nested list. Give folders a `children` array (empty when nothing is in them). Keys work
like the Files panel; double-click or Enter opens a file.

## Props

- `nodes` (`N extends TreeNode ({ id: string; label: string; children?: N[] })[]`, required): The top level.
- `label` (`string`, required): Accessible name.
- `expanded` (`string[]`, default `[]`, bindable): Ids of open folders.
- `selected` (`string | null`, default `null`, bindable): The selected row's id.
- `focused` (`boolean`, default `true`): Show the selection in the focus color while the tree has the focus.
- `height` (`"fill" | number`, default `"fill"`): Fill the parent (which needs a height) or a height in px.
- `iconFor` (`(node: N, open: boolean) => IconName | null`, default `(node) => (node.children ? "folder" : "file")`):
  Icon per row.
- `detail` (`Snippet<[N]>`): Dim content at the end of a row, such as a status letter.
- `onopen` (`(node: N) => void`): A file was opened (double-click or Enter).
- `oncontextmenu` (`(node: N, event: MouseEvent) => void`): Right-click on a row, for its Menu.

## Example: Files

```svelte
<Tree label="Files" {nodes} bind:expanded bind:selected onopen={openFile} />
```

## Replaces in the app

- `the rows of FileExplorer.svelte`

## Logic

- `logic/treeModel.ts`
- `logic/virtualWindow.ts`
