# PaletteRow

One row of a CommandPalette: icon or badge, title with matches, then check, reason, folder and keys.

```ts
import PaletteRow from "$ui/components/PaletteRow.svelte";
```

Group: Overlays. Also known as: Palette item.

## When to use

CommandPalette draws these from its items; use it alone only in a custom list.

## Props

- `item` (`PaletteItem`, required): What the row shows; see CommandPalette.
- `selected` (`boolean`, default `false`): The highlighted row.
- `onhover` (`() => void`): The pointer moved over it.
- `onpick` (`() => void`): Clicked (not when disabled).
- `end` (`Snippet`): Buttons at the end, such as Remove; shown while hovered or selected.

## Example: A file

```svelte
<PaletteRow item={{ id: "a", title: "cart.ts", folder: "src" }} />
```

## Replaces in the app

- `.row in QuickOpen.svelte and RecentFiles.svelte`

## Logic

- `logic/palette.ts`
