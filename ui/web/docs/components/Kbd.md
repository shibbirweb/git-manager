# Kbd

A keyboard shortcut drawn as a key cap.

```ts
import Kbd from "$ui/components/Kbd.svelte";
```

Group: Feedback. Also known as: Kbd, Shortcut.

## When to use

Use in shortcut lists and empty states. Pass text from commandKeys(id) or localKeys(...).

## Props

- `keys` (`string`, required): The shortcut text, e.g. from commandKeys("quickOpen").

## Rules

- Never type a shortcut by hand: Windows shows Ctrl, and users can change keys.

## Example: Shortcut

```svelte
<Kbd keys={commandKeys("quickOpen")} />
```

## Replaces in the app

- `<kbd>...</kbd> in the Keyboard Shortcuts dialog and the empty editor`
