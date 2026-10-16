# CommandPalette

A floating list at the top of the window to find and run something, like Go to File.

```ts
import CommandPalette from "@git-manager/ui/components/CommandPalette.svelte";
```

Group: Overlays. Also known as: Command, Quick open, Combobox.

## When to use

Use for Go to File, Recent Files, Search Everywhere and commands. Filter in the caller (on `query`) and pass the
matching items with their match ranges; give sections to group them. It exports step(by), to move the highlight when the
key that opened it is pressed again, and highlighted(), for a key that acts on the highlighted item. Removing the
highlighted item keeps the highlight at the same place.

## Props

- `open` (`boolean`, default `true`, bindable): Shown or hidden.
- `items` (`PaletteItem[] ({ id; title; ranges?; icon?; fileIcon?; badge?; category?; categoryRanges?; depth?;
  container?; detail?; folder?; folderRanges?; tooltip?; keys?; prefix?; section?; checked?; disabled?; reason?; tone?;
  dirty? })`, default `[]`): The matching items; see logic/palette.ts.
- `query` (`string`, default `""`, bindable): What was typed.
- `placeholder` (`string`, default `"Type to search"`): Shown while empty.
- `status` (`string`, default `""`): Faint text at the field's end, such as a count.
- `statusTone` (`"faint" | "warning"`, default `"faint"`): Warning for a note such as an index still loading.
- `emptyText` (`string`, default `"Nothing found"`): Shown when nothing matches.
- `fieldIcon` (`IconName`, default `"search"`): The field's icon, such as carets in command mode.
- `fieldSize` (`"normal" | "compact"`, default `"normal"`): The field's height: 38 or 34 px (Recent Files).
- `size` (`"normal" | "wide"`, default `"normal"`): Wide for Search Everywhere's longer rows.
- `label` (`string`, required): Accessible name.
- `onpick` (`(item: PaletteItem, event: KeyboardEvent | MouseEvent) => void`): An item was picked; the event tells
  whether Cmd (Ctrl) was held, to open to the side.
- `onkeydown` (`(event: KeyboardEvent) => void`): Runs first for keys in the field; preventDefault keeps a key from the
  palette (switching modes, Tab).
- `onclose` (`() => void`): Esc or a click outside.
- `head` (`Snippet`): A title bar above the field, with filters (Recent Files).
- `scopes` (`Snippet`): Scope tabs above the field, such as All, Files, Symbols.
- `preferred` (`string | null`, default `null`): The item highlighted when the query is new, such as the file before the
  one on screen.
- `rowEnd` (`Snippet<[PaletteItem]>`): Buttons at a row's end, such as Remove; shown while hovered or selected.
- `fieldStart` (`Snippet`): Before the field's icon, such as the chevron that shows a Replace field.
- `fieldEnd` (`Snippet`): Toggles at the field's end, such as Match Case.
- `results` (`Snippet`): The caller's own results instead of `items`, such as a virtual List driven by `field` (Search
  Everywhere); arrows and Enter are left to it.
- `field` (`HTMLInputElement | null`, default `null`, bindable): The search field, to drive a List in `results`.
- `replace` (`Snippet`): A second row under the field, such as a replace field.
- `footer` (`Snippet`): Key hints under the list.

## Example: Go to File

```svelte
<CommandPalette label="Go to File" {items} bind:query onpick={open} />
```

## Replaces in the app

- `src/lib/quickOpen/QuickOpen.svelte`
- `src/lib/recentFiles/RecentFiles.svelte popups`

## Logic

- `logic/palette.ts`
