# Input

A single-line text field. `invalid` draws a red border; Field shows the message under it.

```ts
import Input from "@git-manager/ui/components/Input.svelte";
```

Group: Forms. Also known as: Input, Text field.

## When to use

Use for names, paths and filters. Wrap it in Field for a label, hint or error. Use SearchField to filter.

## Props

- `value` (`string`, default `""`, bindable): The text.
- `invalid` (`boolean`, default `false`): Red border and aria-invalid.
- `mono` (`boolean`, default `false`): Monospace text, for hashes and paths.
- `type` (`string`, default `"text"`): The input type.
- `width` (`"auto" | "fill" | "xsmall" | "small" | "medium" | "large"`, default `"auto"`): auto, the parent's width, or
  80, 120, 180 or 280 px.
- `suggestions` (`string[]`, default `[]`): Values offered while typing, such as installed font names.
- `element` (`HTMLInputElement | null`, default `null`, bindable): The input element, to focus or select it.
- `...rest` (`HTMLInputAttributes`): Any other input attribute: placeholder, disabled, readonly, aria-label, oninput,
  onkeydown.

## Rules

- Give it a visible label (Field) or an aria-label.

## Example: Branch name

```svelte
<Input bind:value={name} placeholder="Branch name" aria-label="Branch name" />
```

## Replaces in the app

- `<input class="input" ...>`
