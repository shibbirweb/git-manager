# Checkbox

A native checkbox with its label; clicking the text toggles it too.

```ts
import Checkbox from "$ui/components/Checkbox.svelte";
```

Group: Forms. Also known as: Checkbox.

## When to use

Use for options inside a dialog or list. Use Switch for settings that apply at once.

## Props

- `checked` (`boolean`, default `false`, bindable): Whether it is ticked.
- `indeterminate` (`boolean`, default `false`): The mixed state, for a select-all box.
- `label` (`string`, default `""`): The text, when `children` is not given.
- `disabled` (`boolean`, default `false`): Disables it.
- `onchange` (`(checked: boolean) => void`): Called with the new state.
- `children` (`Snippet`): Rich label content instead of `label`.

## Example: Commit option

```svelte
<Checkbox label="Sign off" bind:checked={signOff} />
```

## Replaces in the app

- `<label class="check"><input type="checkbox" /> Text</label>`
