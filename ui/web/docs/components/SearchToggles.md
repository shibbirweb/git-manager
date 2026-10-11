# SearchToggles

Match Case, Words and Regex toggles inside a search field.

```ts
import SearchToggles from "$ui/components/SearchToggles.svelte";
```

Group: Editor. Also known as: Toggle group.

## When to use

Use inside a find field. Pass tooltips with keys from localKeys(...) in `titles`.

## Props

- `options` (`SearchOptions ({ matchCase: boolean; wholeWords: boolean; regex: boolean })`, required, bindable): Which
  toggles are on.
- `compact` (`boolean`, default `false`): Smaller toggles for the editor's find bar.
- `titles` (`Partial<Record<keyof SearchOptions, string>>`, default `{}`): Tooltips with their keys.
- `onchange` (`(options: SearchOptions) => void`): Called with the new options.

## Rules

- Never type keys into a tooltip; pass them through `titles` from localKeys.

## Example: Find in Files

```svelte
<SearchToggles bind:options />
```

## Replaces in the app

- `src/lib/ui/SearchToggles.svelte`
