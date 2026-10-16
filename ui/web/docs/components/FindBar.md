# FindBar

The editor's find and replace bar: find field with toggles, match counter, previous, next and close.

```ts
import FindBar from "@git-manager/ui/components/FindBar.svelte";
```

Group: Editor. Also known as: Find, Search bar.

## When to use

Use above an editor. Enter goes to the next match, Shift+Enter the previous, Esc closes, unless the caller passes
`onkeydown` to run its own keys. Buttons never take the focus from the fields. Read-only editors pass
`editable={false}`, which hides Replace. `focus(field, select)` puts the caret in a field.

## Props

- `query` (`string`, default `""`, bindable): The search text.
- `replacement` (`string`, default `""`, bindable): The replace text.
- `options` (`SearchOptions ({ matchCase: boolean; wholeWords: boolean; regex: boolean })`, default `all false`,
  bindable): Toggles.
- `showReplace` (`boolean`, default `false`, bindable): The Replace row is open.
- `editable` (`boolean`, default `true`): Offer Replace (hidden for read-only editors).
- `current` (`number`, default `0`): The current match, from 1.
- `total` (`number`, default `0`): How many matches.
- `counter` (`string | null`, default `null`): Words instead of the counted `2 of 5`, e.g. a notice.
- `active` (`boolean | null`, default `null`): Enables the step and replace buttons; null means `total > 0`.
- `problem` (`string | null`, default `null`): Tints the field red and is its tooltip, e.g. `Bad regex`.
- `label` (`string`, default `"Find in file"`): The bar's accessible name.
- `titles` (`FindBarTitles`, default `{}`): Tooltips per button (previous, next, selectAll, replace, ...).
- `toggleTitles` (`Partial<Record<keyof SearchOptions, string>>`, default `{}`): Tooltips of the toggles.
- `onsearch` (`(query: string, options: SearchOptions) => void`): The query or a toggle changed.
- `onreplaceinput` (`(replacement: string) => void`): The replace text changed.
- `ontogglereplace` (`(open: boolean) => void`): The chevron opened or closed Replace.
- `onkeydown` (`(event: KeyboardEvent, field: FindField) => void`): Runs instead of the bar's own keys.
- `onnext` (`() => void`): Next match (Enter or the down arrow).
- `onprevious` (`() => void`): Previous match (Shift+Enter or the up arrow).
- `onreplace` (`() => void`): Replace the current match.
- `onreplaceall` (`() => void`): Replace every match.
- `onselectall` (`() => void`): Select every match; shows the button (hidden when the bar is narrow).
- `onexclude` (`() => void`): Skip this match; shows Exclude in the Replace row (hidden when narrow).
- `onclose` (`() => void`): Esc or the close button.

## Example: Editor find

```svelte
<FindBar bind:query {current} {total} onnext={next} onprevious={previous} onclose={close} />
```

## Replaces in the app

- `src/lib/editor/FindBar.svelte's markup (the search logic stays in the editor)`
