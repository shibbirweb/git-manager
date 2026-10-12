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

- `variant` (`"default" | "primary" | "danger" | "danger-primary" | "ghost"`, default `"default"`): Look and weight;
  ghost is borderless, like the header's pickers.
- `size` (`"normal" | "small" | "tiny" | "mini"`, default `"normal"`): Small is 24px (toolbars, rows); tiny 22px (media
  bars); mini 20px (group headers).
- `pressed` (`boolean | null`, default `null`): A pressed choice (Fit, 100%): selected tint and aria-pressed.
- `icon` (`IconName | null`, default `null`): An icon before the text.
- `badge` (`number | null`, default `null`): A count on the top right corner, such as options turned on.
- `count` (`number | null`, default `null`): A dim count after the words, like the repository picker's.
- `trailingIcon` (`IconName | null`, default `null`): An icon after the text, such as a picker's chevron.
- `type` (`"button" | "submit" | "reset"`, default `"button"`): The button's form type.
- `element` (`HTMLButtonElement | null`, default `null`, bindable): The button element, to focus it.
- `children` (`Snippet`): The text.
- `...rest` (`HTMLButtonAttributes`): Any other button attribute: onclick, disabled, title, aria-*.

## Rules

- Keep labels short and plain; never type a shortcut into a label (use commandKeys in the tooltip).
- Destructive actions confirm first (a message Dialog with a Danger primary button).

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
