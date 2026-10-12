# StatusDot

A small round dot that tells a state: a command's result, a server on or off, a run going on.

```ts
import StatusDot from "$ui/components/StatusDot.svelte";
```

Group: Feedback. Also known as: Dot, Indicator, Status.

## When to use

Use before a row or label. `pulse` while something runs; `small` in a status bar button.

## Props

- `tone` (`"neutral" | "success" | "danger" | "warning" | "accent"`, default `"neutral"`): The state's color.
- `pulse` (`boolean`, default `false`): Fades in and out while something runs.
- `size` (`"normal" | "small"`, default `"normal"`): 8 or 6 px.
- `label` (`string`): Read by screen readers and shown as a tooltip.

## Example: A running command

```svelte
<StatusDot tone="neutral" pulse label="Running" />
```

## Replaces in the app

- `.status in GitConsoleView`
- `.dot in McpToolsDialog`
- `.dot in KeepAwake`
