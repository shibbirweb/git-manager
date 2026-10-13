# IconButton

A borderless icon button, optionally with text after the icon; `label` is its name and tooltip.

```ts
import IconButton from "$ui/components/IconButton.svelte";
```

Group: Actions. Also known as: Toggle.

## When to use

Use in toolbars, panel headers, rows and tab strips. Use Button when the command needs a word.

## Props

- `icon` (`IconName`, required): The icon.
- `label` (`string`, required): Accessible name; also the tooltip unless `title` is given.
- `iconSize` (`IconSize`, default `"large"`): A named icon size (see Icon).
- `size` (`"large" | "normal" | "header" | "compact" | "small" | "chevron" | "inline" | "mini" | "micro" | "tool" |
  "row"`, default `"normal"`): 28px; large 30px (a sidebar's foot); header 26px (Back, Forward); compact 24px (panels);
  small 22px; chevron 24px and narrow (a menu half); inline 22px square (a list row's action); mini 20px (a sidebar
  row's buttons); micro 18px (a list row's Remove); row 20px with a stronger hover (repository rows); tool 24 by 22px,
  dim (file bar).
- `tone` (`"default" | "dim" | "faint" | "dim-danger" | "success" | "danger"`, default `"default"`): Dim or faint until
  hovered (a message box's tools); dim-danger turns red when hovered (Drop); success or danger for Run and Stop.
- `active` (`boolean`, default `false`): Pressed look and aria-pressed, for toggles.
- `spinning` (`boolean`, default `false`): The icon turns, such as Refresh while it runs.
- `count` (`string`, default `""`): Short text after the icon, such as a repository row's sync counts.
- `type` (`"button" | "submit" | "reset"`, default `"button"`): The button's form type.
- `title` (`string`): Tooltip when it should differ from `label`.
- `keepFocus` (`boolean`, default `false`): Pressing it leaves the focus where it was, such as in a search field.
- `element` (`HTMLButtonElement | null`, default `null`, bindable): The button element.
- `children` (`Snippet`): Optional text after the icon.
- `...rest` (`HTMLButtonAttributes`): Any other button attribute: onclick, disabled, aria-*.

## Rules

- Always give a `label`; an icon alone has no name for screen readers.

## Example: Toolbar

```svelte
<IconButton icon="refresh" label="Refresh" onclick={refresh} />
```

## Example: Toggle

```svelte
<IconButton icon="pin" label="Pin" active={pinned} onclick={togglePin} />
```

## Replaces in the app

- `<button class="icon-btn" title="..." aria-label="...">`
