# List

The keyboard and selection around Rows: a listbox, a tree or a plain list, optionally virtual.

```ts
import List from "$ui/components/List.svelte";
```

Group: Navigation. Also known as: Listbox, Tree view, Selectable list, Virtual list.

## When to use

Give it the items and a `row` snippet that draws a Row with the state it gets. Arrows, Home, End and Page keys move,
Enter or a double-click activates, Left and Right fold tree rows, `multiple` selects several. `skip` names headings the
keys pass over. `virtual` draws only the rows in view: give it the Row's height (normal for tree and list rows, relaxed
for history rows).

## Props

- `items` (`T[]`, required): Every row's item, headings included.
- `itemKey` (`(item: T) => string`, required): An item's id.
- `label` (`string`, required): Accessible name.
- `role` (`"listbox" | "tree" | "list"`, default `"listbox"`): A pick list, a tree, or a plain list with no selection.
- `selected` (`string | null`, default `null`, bindable): The current row's id.
- `selection` (`string[]`, default `[]`, bindable): The selected rows' ids, with `multiple`.
- `multiple` (`boolean`, default `false`): Cmd or Ctrl adds a row, Shift a range, Cmd+A all.
- `skip` (`(item: T) => boolean`, default `() => false`): Rows that cannot be picked, such as group headings.
- `level` (`(item: T) => number`, default `() => 0`): A tree row's level, 0 at the top.
- `expanded` (`(item: T) => boolean | null`, default `() => null`): Whether a tree row is open; null for a leaf.
- `height` (`"auto" | "fill" | "small" | "medium" | "large"`, default `"auto"`): Its content's height, its parent's, or
  scroll past 160, 240 or 360 px.
- `virtual` (`"compact" | "normal" | "relaxed" | "comfortable" | null`, default `null`): Draw only the rows in view,
  each this tall.
- `row` (`Snippet<[T, ListRowState]>`, required): Draws a row from its item and { index, selected, current }.
- `empty` (`Snippet`): Shown when there are no items, such as an EmptyState.
- `onselect` (`(item: T) => void`): A row was selected by click or key.
- `onactivate` (`(item: T) => void`): Enter or a double-click on a row.
- `ontoggle` (`(item: T, open: boolean) => void`): Left or Right asks to fold or unfold a tree row.
- `oncontextmenu` (`(event: MouseEvent, item: T) => void`): Right-clicked; the row is selected first.

## Rules

- The List holds the focus; Rows inside take none and draw only their look.

## Example: Changed files

```svelte
<List label="Changed files" items={files} itemKey={(f) => f.path} bind:selected onactivate={open}>
  {#snippet row(file, state)}
    <Row selected={state.selected}>
      <StatusLetter kind={file.kind} /><Text truncate>{file.name}</Text>
    </Row>
  {/snippet}
</List>
```

## Replaces in the app

- `.files in ChangesTab and BranchFileList, .list in FileHistoryTab, LineHistoryTab and ReflogTab`
- `.versions in LocalHistoryDialog, .tree in ScriptsPanel and Sidebar, .list in AiPanel and ShelfPanel`
- `.table in ConflictsDialog, .list in TerminalPanel`

## Logic

- `logic/listNav.ts`
- `logic/treeSelect.ts`
- `logic/virtualWindow.ts`
