# RenameField

A name edited in place: a small accent-bordered field; Enter keeps, Escape cancels, red when taken.

```ts
import RenameField from "@git-manager/ui/components/RenameField.svelte";
```

Group: Forms. Also known as: Inline rename.

## When to use

Use for renaming a terminal; Tree rows have their own.

## Props

- `value` (`string`, required): The current name.
- `label` (`string`, default `"New name"`): Accessible name.
- `invalid` (`boolean`, default `false`): The name cannot be used.
- `onrename` (`(name: string | null) => void`, required): The new name, or null to cancel.
- `oninput` (`(name: string) => void`): Each change, to check it.

## Example: Terminal

```svelte
<RenameField value="zsh" onrename={rename} />
```

## Replaces in the app

- `.rename in src/lib/terminal/TerminalPanel.svelte`
