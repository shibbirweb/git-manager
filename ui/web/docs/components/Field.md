# Field

A labelled form field: the label, the control, then a hint or an error under it.

```ts
import Field from "$ui/components/Field.svelte";
```

Group: Forms. Also known as: Field, Form item, Label.

## When to use

Wrap Input, TextArea or Select in dialogs. Show `error` only after the user typed, and keep it short.

## Props

- `label` (`string`, default `""`): The label above the control.
- `hint` (`string`, default `""`): Help under the control, hidden while there is an error.
- `error` (`string | null`, default `null`): Validation message in red, announced to screen readers.
- `children` (`Snippet`, required): The control.

## Example: Branch name

```svelte
<Field label="New branch name" {error}>
  <Input bind:value={name} invalid={error !== null} />
</Field>
```

## Replaces in the app

- `<label class="field"><span>Label</span><input class="input" /></label>`
- `<div class="error">`
