# SearchField

A filter box with a magnifier and a clear button, like Settings' search. Esc clears, then blurs.

```ts
import SearchField from "$ui/components/SearchField.svelte";
```

Group: Forms. Also known as: Input group, Search.

## When to use

Use to filter a list as the user types. Use Input for values that are saved.

## Props

- `value` (`string`, default `""`, bindable): The query.
- `placeholder` (`string`, default `"Search"`): Shown while empty.
- `label` (`string`, required): Accessible name.
- `autofocus` (`boolean`, default `false`): Focus it when it appears.
- `element` (`HTMLInputElement | null`, default `null`, bindable): The input element.
- `oninput` (`(value: string) => void`): Called on every change, also when cleared.
- `onkeydown` (`(event: KeyboardEvent) => void`): Runs first; call preventDefault to keep Esc.

## Example: Filter

```svelte
<SearchField label="Filter files" bind:value={query} />
```

## Replaces in the app

- `<div class="search"><Icon name="search" /><input /><button class="clear">`
