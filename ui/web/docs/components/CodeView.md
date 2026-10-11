# CodeView

Read-only, highlighted code with line numbers and a Copy button, in CodeMirror like the editors.

```ts
import CodeView from "$ui/components/CodeView.svelte";
```

Group: Editor. Also known as: Code block, Code.

## When to use

Use to show code, output or a file's text without editing. Use the app's editor for editing.

## Props

- `source` (`string`, required): The text.
- `language` (`"svelte" | "html" | "ts" | "js" | "md" | "plain"`, default `"plain"`): Highlighting.
- `lineNumbers` (`boolean`, default `true`): Show line numbers.
- `copy` (`boolean`, default `true`): Show the Copy button.
- `maxHeight` (`number | null`, default `520`): Scroll beyond this height in px; null grows to fit.

## Example: A snippet

```svelte
<CodeView source={code} language="ts" />
```

## Replaces in the app

- `read-only CodeMirror views built by hand`
