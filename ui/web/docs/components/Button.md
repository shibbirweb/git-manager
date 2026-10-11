# Button

A text button: Default, Primary for the main action, Danger, or Danger primary for a destructive confirm.

```ts
import Button from "$ui/components/Button.svelte";
```

Group: Actions. Also known as: Button.

## When to use

Use for dialog actions and commands with a word on them. One Primary button per dialog or form. Use IconButton for
icon-only commands in toolbars and rows.

## Props

- `variant` (`"default" | "primary" | "danger" | "danger-primary"`, default `"default"`): Look and weight.
- `size` (`"normal" | "small"`, default `"normal"`): Small is 24px high, for toolbars and rows.
- `icon` (`IconName | null`, default `null`): An icon before the text.
- `type` (`"button" | "submit" | "reset"`, default `"button"`): The button's form type.
- `element` (`HTMLButtonElement | null`, default `null`, bindable): The button element, to focus it.
- `children` (`Snippet`): The text.
- `...rest` (`HTMLButtonAttributes`): Any other button attribute: onclick, disabled, title, aria-*.

## Rules

- Keep labels short and plain; never type a shortcut into a label (use commandKeys in the tooltip).
- Destructive actions confirm first (ConfirmDialog with danger).

## Example: Dialog actions

```svelte
<Button onclick={cancel}>Cancel</Button>
<Button variant="primary" onclick={save}>Save</Button>
```

## Example: Destructive confirm

```svelte
<Button variant="danger-primary" onclick={remove}>Delete Branch</Button>
```

## Replaces in the app

- `<button class="btn">`
- `<button class="btn primary">`
- `<button class="btn danger">`
- `<button class="btn small">`
- `<button class="btn primary danger-fill">`
