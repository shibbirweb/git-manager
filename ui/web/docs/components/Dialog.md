# Dialog

A modal dialog over a dimmed window: a title, the content and the actions on the right.

```ts
import Dialog from "$ui/components/Dialog.svelte";
```

Group: Overlays. Also known as: Dialog, Modal.

## When to use

Use for tasks that need a few inputs, such as New Branch. Use ConfirmDialog for a yes or no question. Keep one Primary
button in `actions`, last.

## Props

- `open` (`boolean`, default `false`, bindable): Shown or hidden.
- `title` (`string`, required): The heading; also the dialog's accessible name.
- `width` (`"normal" | "wide"`, default `"normal"`): 460 or 640 px.
- `dismissible` (`boolean`, default `true`): Esc and a click on the dim area close it.
- `onclose` (`() => void`): Called when the user dismisses it (Esc or outside click).
- `actions` (`Snippet`): Buttons on the right under the content.
- `children` (`Snippet`, required): The content.

## Rules

- Focus goes into the dialog when it opens and back when it closes; do not move it by hand.

## Example: New Branch

```svelte
<Dialog bind:open title="New Branch">
  <Field label="Name"><Input bind:value={name} /></Field>
  {#snippet actions()}
    <Button onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" onclick={create}>Create</Button>
  {/snippet}
</Dialog>
```

## Replaces in the app

- `<div class="overlay"><div class="dialog" role="dialog">...</div></div>`
- `Git menu dialogs`
