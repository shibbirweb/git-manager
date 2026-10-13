# Dialog

A modal dialog over a dimmed window: a title, the content and the actions on the right.

```ts
import Dialog from "$ui/components/Dialog.svelte";
```

Group: Overlays. Also known as: Dialog, Modal.

## When to use

Use for tasks that need a few inputs, such as New Branch. Use the `message` variant for a yes or no question. Keep one
Primary button in `actions`, last.

## Props

- `open` (`boolean`, default `false`, bindable): Shown or hidden.
- `title` (`string`, required): The heading; also the dialog's accessible name.
- `variant` (`"message" | "form" | "split" | "panel"`, default `"message"`): A question and buttons, the Git dialogs'
  form, Settings' side column and content, or a large panel with a scrolling body (Shortcuts, What's New).
- `width` (`"small" | "normal" | "medium" | "large" | "xlarge" | "full"`, default `small (message), normal (form), large
  (panel)`): 460, 520, 560, 620, 760 or 1200 px; split dialogs have their own size.
- `dismissible` (`boolean`, default `true`): Esc and a click on the dim area close it.
- `movable` (`boolean`, default `false`): Drag the title to move it; double-click the title centers it.
- `subtitle` (`string`, default `""`): A dim line under the title.
- `icon` (`IconName | null`, default `null`): An icon on a tinted tile before the title.
- `iconTone` (`"accent" | "success" | "warning" | "danger"`, default `"accent"`): The tile's color.
- `toolbar` (`Snippet`): A bar under the head, such as a Toolbar with a filter (panel dialogs).
- `footnote` (`Snippet`): Content at the footer's start, such as a Link or a hint.
- `onclose` (`() => void`): Called when the user dismisses it (Esc or outside click).
- `onsubmit` (`() => void`): Cmd+Enter (Ctrl+Enter): the main action of a form.
- `enterSubmits` (`boolean`, default `false`): A plain Enter in a one-line field submits too, like a one-field prompt or
  a password; Enter in a text area or on a button does not.
- `actions` (`Snippet`): Buttons on the right under the content.
- `sidebar` (`Snippet`): The side column of a split dialog, such as a SideNav.
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

## Example: A prompt that Enter submits

```svelte
<Dialog bind:open title="Password" onsubmit={send} enterSubmits>
  <Input type="password" bind:value={password} />
  {#snippet actions()}<Button variant="primary" onclick={send}>OK</Button>{/snippet}
</Dialog>
```

## Replaces in the app

- `<div class="overlay"><div class="dialog" role="dialog">...</div></div>`
- `Git menu dialogs`
- `<form onsubmit> around a prompt's field (Enter submits)`

## Logic

- `logic/dialogKeys.ts`
