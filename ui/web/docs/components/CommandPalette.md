# CommandPalette

A floating list at the top of the window to find and run something, like Go to File.

```ts
import CommandPalette from "$ui/components/CommandPalette.svelte";
```

Group: Overlays. Also known as: Command, Quick open, Combobox.

## When to use

Use for Go to File, Recent Files, Search Everywhere and commands. Filter in the caller (on `query`) and pass the
matching items with their match ranges; give sections to group them.

## Props

- `open` (`boolean`, default `true`, bindable): Shown or hidden.
- `items` (`PaletteItem[] ({ id; title; ranges?; icon?; fileIcon?; badge?; category?; depth?; container?; detail?;
  folder?; keys?; prefix?; section?; checked?; disabled?; reason?; tone?; dirty? })`, required): The matching items; see
  logic/palette.ts.
- `query` (`string`, default `""`, bindable): What was typed.
- `placeholder` (`string`, default `"Type to search"`): Shown while empty.
- `status` (`string`, default `""`): Faint text at the field's end, such as a count.
- `statusTone` (`"faint" | "warning"`, default `"faint"`): Warning for a note such as an index still loading.
- `emptyText` (`string`, default `"Nothing found"`): Shown when nothing matches.
- `fieldIcon` (`IconName`, default `"search"`): The field's icon, such as carets in command mode.
- `fieldSize` (`"normal" | "compact"`, default `"normal"`): The field's height: 38 or 34 px (Recent Files).
- `size` (`"normal" | "wide"`, default `"normal"`): Wide for Search Everywhere's longer rows.
- `label` (`string`, required): Accessible name.
- `onpick` (`(item: PaletteItem) => void`, required): An item was picked.
- `onclose` (`() => void`): Esc or a click outside.
- `head` (`Snippet`): A title bar above the field, with filters (Recent Files).
- `scopes` (`Snippet`): Scope tabs above the field, such as All, Files, Symbols.
- `fieldEnd` (`Snippet`): Toggles at the field's end, such as Match Case.
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
