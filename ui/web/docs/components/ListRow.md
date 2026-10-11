# ListRow

A row of a pick or command list: a label and a dim description; the highlighted row is accent-filled.

```ts
import ListRow from "$ui/components/ListRow.svelte";
```

Group: Navigation. Also known as: Item, Option.

## When to use

Use inside PickList-like lists. Use Tree rows for files and Menu for commands.

## Props

- `label` (`string`, required): The main text.
- `description` (`string`, default `""`): Dim text after the label.
- `icon` (`IconName | null`, default `null`): An icon before the label.
- `highlighted` (`boolean`, default `false`): The keyboard or pointer row.
- `disabled` (`boolean`, default `false`): Cannot be picked.
- `onclick` (`() => void`): Picked with the pointer.
- `onhover` (`() => void`): The pointer moved over it, to move the highlight.
- `trailing` (`Snippet`): Content at the right end.

## Example: Branch

```svelte
<ListRow icon="branch" label="main" description="current" highlighted />
```

## Replaces in the app

- `<button class="pick-row"> in DialogHost.svelte`
