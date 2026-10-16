# List

The keyboard and selection around Rows: a listbox, a tree or a plain list, optionally virtual.

```ts
import List from "@git-manager/ui/components/List.svelte";
```

Group: Navigation. Also known as: Listbox, Tree view, Selectable list, Virtual list.

## When to use

Give it the items and a `row` snippet that draws a Row with the state it gets. Arrows, Home, End and Page keys move,
Enter or a double-click activates, Left and Right fold tree rows, `multiple` selects several. `skip` names headings the
keys pass over. `virtual` draws only the rows in view: give it the Row's height (normal for tree and list rows, relaxed
for history rows). A filter field drives it with `field`: Down or Enter moves the focus in, or with `fieldKeys="drive"`
the field keeps the focus while Up, Down and Enter work the list (Quick Open, Recent Files, the Branches popup).
`focus()` takes the focus and `reveal(key, place)` scrolls a row the app selected into view, to the middle with
`center`.

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
- `height` (`"auto" | "fill" | "small" | "medium" | "large" | "xlarge"`, default `"auto"`): Its content's height, its
  parent's, or scroll past 160, 240, 360 or 468 px (a palette's results).
- `virtual` (`"compact" | "normal" | "relaxed" | "comfortable" | null`, default `null`): Draw only the rows in view,
  each this tall (the estimate with `measure`).
- `measure` (`boolean`, default `false`): Rows differ in height, like console entries that open: each drawn row is
  measured.
- `field` (`HTMLInputElement | null`, default `null`): A filter field above it whose keys work the list.
- `fieldKeys` (`"enter" | "drive"`, default `"enter"`): Down or Enter in the field moves the focus in, or the field
  keeps the focus while Up, Down, Page keys and Enter work the list; clicks keep the focus in the field.
- `follow` (`boolean`, default `false`): Stay at the bottom while entries arrive, until the user scrolls up (a console).
- `row` (`Snippet<[T, ListRowState]>`, required): Draws a row from its item and { index, selected, current }.
- `empty` (`Snippet`): Shown when there are no items, such as an EmptyState.
- `onselect` (`(item: T) => void`): A row was selected by click or key.
- `clickActivates` (`boolean`, default `false`): A click picks a row like Enter, not only selects it (search results).
- `onactivate` (`(item: T, event?: KeyInput | MouseEvent) => void`): Enter or a double-click on a row (a click with
  clickActivates); the event tells whether Shift or Cmd was held.
- `ontoggle` (`(item: T, open: boolean) => void`): Left or Right asks to fold or unfold a tree row.
- `oncontextmenu` (`(event: MouseEvent, item: T, fromKeys?: boolean) => void`): Right-clicked (the row is selected
  first), or the menu key or Shift+F10 on the current row: `fromKeys`, with the event under the row's start.
- `onkeydown` (`(event: KeyboardEvent, fromField: boolean) => void`): Runs first for a key in the list or its field;
  call preventDefault to keep the key from the list, such as Delete removing a branch.
- `onnearend` (`() => void`): Scrolled near the end: load the next page (once per item count).

## Rules

- The List holds the focus; Rows inside take none and draw only their look.
- onnearend and follow need a list that scrolls itself: height fill, small, medium or large, or virtual.

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

## Example: Driven from a filter field (Quick Open)

```svelte
<Input bind:element={filter} bind:value={query} aria-label="Search" />
<List label="Results" items={found} itemKey={(f) => f.path} field={filter} fieldKeys="drive"
  height="fill" virtual="normal" onactivate={open}>
  {#snippet row(file, state)}<Row selected={state.selected}><Text>{file.name}</Text></Row>{/snippet}
</List>
```

## Replaces in the app

- `.files in ChangesTab and BranchFileList, .list in FileHistoryTab, LineHistoryTab and ReflogTab`
- `.versions in LocalHistoryDialog, .tree in ScriptsPanel and Sidebar, .list in AiPanel and ShelfPanel`
- `.table in ConflictsDialog, .list in TerminalPanel, .list in GitConsoleView`

## Logic

- `logic/listKeys.ts`
- `logic/listNav.ts`
- `logic/listField.ts`
- `logic/listScroll.ts`
- `logic/listWiring.svelte.ts`
- `logic/treeSelect.ts`
- `logic/virtualWindow.ts`
- `logic/rowOffsets.ts`
- `logic/rowHeights.svelte.ts`
