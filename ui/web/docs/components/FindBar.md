# FindBar

The editor's find and replace bar: find field with toggles, match counter, previous, next and close.

```ts
import FindBar from "$ui/components/FindBar.svelte";
```

Group: Editor. Also known as: Find, Search bar.

## When to use

Use above an editor. Enter goes to the next match, Shift+Enter the previous, Esc closes. Read-only editors pass
`editable={false}`, which hides Replace.

## Props

- `query` (`string`, default `""`, bindable): The search text.
- `replacement` (`string`, default `""`, bindable): The replace text.
- `options` (`SearchOptions ({ matchCase: boolean; wholeWords: boolean; regex: boolean })`, default `all false`,
  bindable): Toggles.
- `showReplace` (`boolean`, default `false`, bindable): The Replace row is open.
- `editable` (`boolean`, default `true`): Offer Replace (hidden for read-only editors).
- `current` (`number`, default `0`): The current match, from 1.
- `total` (`number`, default `0`): How many matches.
- `problem` (`string | null`, default `null`): Shown in red instead of the counter, e.g. `Bad regex`.
- `onsearch` (`(query: string, options: SearchOptions) => void`): The query or a toggle changed.
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
