# TextArea

A multi-line text field, like the commit message box.

```ts
import TextArea from "@nibtree/ui/components/TextArea.svelte";
```

Group: Forms. Also known as: Textarea.

## When to use

Use for commit messages, tag messages and notes.

## Props

- `value` (`string`, default `""`, bindable): The text.
- `rows` (`"small" | "normal" | "large" | "xlarge"`, default `"normal"`): Visible lines: 2, 3, 5 or 8.
- `height` (`"rows" | "short" | "tall"`, default `"rows"`): Its height from `rows`, or a set height: short 56 px (a
  repository's own commit box), tall 96 px (the commit message).
- `resize` (`"none" | "vertical"`, default `"none"`): Whether the user can drag its height.
- `invalid` (`boolean`, default `false`): Red border and aria-invalid.
- `mono` (`boolean`, default `false`): Monospace text.
- `element` (`HTMLTextAreaElement | null`, default `null`, bindable): The textarea element.
- `tools` (`Snippet`): Small buttons in its top right corner (IconButton size small, tone dim), such as Message History;
  the text keeps clear of them.
- `...rest` (`HTMLTextareaAttributes`): Any other textarea attribute: placeholder, disabled, aria-label, onkeydown.

## Example: Commit message

```svelte
<TextArea bind:value={message} rows="large" placeholder="Commit message" />
```

## Example: With tools in the corner

```svelte
<TextArea bind:value={message} height="tall" aria-label="Commit message">
  {#snippet tools()}
    <IconButton icon="history" label="Message History" size="small" tone="dim" iconSize="medium" />
  {/snippet}
</TextArea>
```

## Replaces in the app

- `<textarea class="input" ...>`
- `<div class="message-wrap"> and .message-tools in CommitBox.svelte`
