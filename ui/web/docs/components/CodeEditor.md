# CodeEditor

An editable code view in the app's editor look: line numbers, active line, selection, syntax colors.

```ts
import CodeEditor from "$ui/components/CodeEditor.svelte";
```

Group: Editor. Also known as: Editor, Code editor, CodeMirror.

## When to use

Use for any editable text: files, Untitled tabs, commit messages with code. The app adds blame, find, folding and change
markers through `extensions`; read-only code to show only is CodeView.

## Props

- `value` (`string`, default `""`, bindable): The text.
- `language` (`"plain" | "ts" | "js" | "svelte" | "html" | "css" | "json" | "md" | "python" | "rust"`, default
  `"plain"`): Syntax colors; each language loads on first use.
- `readOnly` (`boolean`, default `false`): No typing, still selectable.
- `lineNumbers` (`boolean`, default `true`): The line number gutter.
- `wrap` (`boolean`, default `false`): Wrap long lines.
- `height` (`"fill" | "small" | "medium" | "large"`, default `"fill"`): Fill the parent, or 160, 240 or 360 px.
- `label` (`string`, required): Accessible name.
- `extensions` (`Extension[]`, default `[]`): More CodeMirror extensions from the app.
- `onchange` (`(value: string) => void`): Called after each edit.

## Rules

- Never style .cm-* classes in a screen: colors come from the editor theme.

## Example: A file

```svelte
<CodeEditor label="main.ts" language="ts" bind:value={text} />
```

## Replaces in the app

- `the CodeMirror setup in src/lib/views/files/FileView.svelte`
- `UntitledView.svelte`
