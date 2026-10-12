# AppHeader

The bar across the top of the window: navigation and pickers on the left, busy work and actions right.

```ts
import AppHeader from "$ui/components/AppHeader.svelte";
```

Group: Layout. Also known as: Header, Title bar, Top bar.

## When to use

Use once, as AppShell's header. Put history buttons, a vertical Divider and the folder, repository and branch pickers
(Button ghost with trailingIcon) in `start`; set `busy` while an operation runs.

## Props

- `busy` (`string`, default `""`): What is running; shows a spinner with it.
- `busyTitle` (`string`): A longer tooltip for the busy text.
- `start` (`Snippet`, required): Left side; shrinks and truncates first.
- `end` (`Snippet`): Right side actions.

## Example: Window

```svelte
<AppHeader busy={progress} {start} {end} />
```

## Replaces in the app

- `src/lib/views/Header.svelte layout`
