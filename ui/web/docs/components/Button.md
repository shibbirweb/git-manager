# Button

A text button: Default, Primary for the main action, Danger, or Danger primary for a destructive confirm.

```ts
import Button from "@nibtree/ui/components/Button.svelte";
```

Group: Actions. Also known as: Button.

## When to use

Use for dialog actions and commands with a word on them. One Primary button per dialog or form. Use IconButton for
icon-only commands in toolbars and rows.

## Props

- `variant` (`"default" | "primary" | "danger" | "danger-primary" | "ghost" | "accent"`, default `"default"`): Look and
  weight; ghost is borderless, like the header's pickers; accent has accent words and border, like Commit Options while
  options are on. An icon alone keeps 6px at each side.
- `size` (`"normal" | "small" | "tiny" | "mini"`, default `"normal"`): Small is 24px (toolbars, rows); tiny 22px (media
  bars); mini 20px (group headers).
- `pressed` (`boolean | null`, default `null`): A pressed choice (Fit, 100%): selected tint and aria-pressed.
- `icon` (`IconName | null`, default `null`): An icon before the text.
- `badge` (`number | null`, default `null`): A count on the top right corner, such as options turned on.
- `count` (`number | null`, default `null`): A dim count after the words, like the repository picker's.
- `trailingIcon` (`IconName | null`, default `null`): An icon after the text, such as a picker's chevron.
- `layout` (`"sidebar-left" | "sidebar-right" | "commit-single" | "commit-per-repo" | null`, default `null`): A drawn
  layout glyph (see LayoutIcon) in place of `icon`, such as the Changes tab's file list toggle.
- `layoutActive` (`boolean`, default `false`): Fills the layout glyph, such as while the file list is shown.
- `spinning` (`boolean`, default `false`): The icon turns, such as Refresh while it runs.
- `width` (`"auto" | "fill"`, default `"auto"`): Its words' width, or its parent's whole width with the words centered
  (Sync Changes under the commit box).
- `type` (`"button" | "submit" | "reset"`, default `"button"`): The button's form type.
- `keepFocus` (`boolean`, default `false`): Pressing it leaves the focus where it was, such as in a search field.
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
