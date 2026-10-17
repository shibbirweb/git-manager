# CodeBlock

Plain monospace text without an editor: command output, a command to run, or error details.

```ts
import CodeBlock from "@nibtree/ui/components/CodeBlock.svelte";
```

Group: Editor. Also known as: Pre, Output.

## When to use

Use for read-only text that needs no highlighting. Use CodeView for highlighted code.

## Props

- `text` (`string`, required): The text.
- `variant` (`"output" | "command" | "detail" | "preview" | "prompt" | "value"`, default `"output"`): Console output, a
  dialog's git command, error details, a file's text before it is used (a gist), an agent's prompt, or one short value
  next to its buttons (a folder path, a token).
- `maxHeight` (`"none" | "small" | "medium" | "large"`, default `"none"`): Scroll beyond 200, 360 or 520 px.
- `label` (`string`): Accessible name.

## Example: Command

```svelte
<CodeBlock variant="command" text="git pull --rebase origin main" />
```

## Replaces in the app

- `<pre class="block"> in GitConsoleView`
- `<div class="command"> in Git dialogs`
- `toast details`
