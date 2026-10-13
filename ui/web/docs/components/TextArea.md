# TextArea

A multi-line text field, like the commit message box.

```ts
import TextArea from "@git-manager/ui/components/TextArea.svelte";
```

Group: Forms. Also known as: Textarea.

## When to use

Use for commit messages, tag messages and notes.

## Props

- `value` (`string`, default `""`, bindable): The text.
- `rows` (`"small" | "normal" | "large" | "xlarge"`, default `"normal"`): Visible lines: 2, 3, 5 or 8.
- `resize` (`"none" | "vertical"`, default `"none"`): Whether the user can drag its height.
- `invalid` (`boolean`, default `false`): Red border and aria-invalid.
- `mono` (`boolean`, default `false`): Monospace text.
- `element` (`HTMLTextAreaElement | null`, default `null`, bindable): The textarea element.
- `...rest` (`HTMLTextareaAttributes`): Any other textarea attribute: placeholder, disabled, aria-label, onkeydown.

## Example: Commit message

```svelte
<TextArea bind:value={message} rows={4} placeholder="Commit message" />
```

## Replaces in the app

- `<textarea class="input" ...>`
