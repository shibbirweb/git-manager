# ConfirmDialog

Asks before an action: a title, a message and Cancel / OK; `danger` makes the confirm button red.

```ts
import ConfirmDialog from "$ui/components/ConfirmDialog.svelte";
```

Group: Overlays. Also known as: Alert dialog, Confirm.

## When to use

Use before anything that loses work or cannot be undone. The confirm label names the action.

## Props

- `open` (`boolean`, default `false`, bindable): Shown or hidden.
- `title` (`string`, required): The question, e.g. `Discard all changes?`.
- `message` (`string`, default `""`): What happens, in a sentence or two.
- `confirmLabel` (`string`, default `"OK"`): The confirm button, e.g. `Discard`.
- `cancelLabel` (`string`, default `"Cancel"`): The cancel button.
- `danger` (`boolean`, default `false`): A red confirm button for destructive actions.
- `onconfirm` (`() => void`, required): Called on confirm.
- `oncancel` (`() => void`): Called on Cancel, Esc or an outside click.

## Rules

- Destructive actions always confirm first, with `danger`.

## Example: Destructive

```svelte
<ConfirmDialog bind:open danger title="Discard all changes?" confirmLabel="Discard"
  onconfirm={discardAll} />
```

## Replaces in the app

- `dialogs.confirm({ title, message, danger }) from src/lib/ui/dialog.svelte.ts`
