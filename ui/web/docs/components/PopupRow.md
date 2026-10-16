# PopupRow

A row of a picker popup: an action, or an item with an icon, a name, a hint and a chevron.

```ts
import PopupRow from "@git-manager/ui/components/PopupRow.svelte";
```

Group: Navigation. Also known as: Branch row, Picker row.

## When to use

Use in the branches popup; the highlighted row takes the selection color.

## Props

- `label` (`string`, required): The words.
- `variant` (`"action" | "item"`, default `"item"`): An action, or an item in a grid.
- `icon` (`IconName | null`, default `null`): An icon first.
- `hint` (`string`, default `""`): A dim hint.
- `current` (`boolean`, default `false`): The current one, bold.
- `chevron` (`boolean`, default `false`): Opens more.
- `highlighted` (`boolean`, default `false`): The highlighted row.
- `disabled` (`boolean`, default `false`): Cannot be picked.
- `onclick` (`() => void`): Picked.
- `onhover` (`() => void`): The pointer moved over it.

## Example: A branch

```svelte
<PopupRow icon="branch" label="main" current chevron />
```

## Replaces in the app

- `.action and .branch in src/lib/views/git/BranchesPopup.svelte`
