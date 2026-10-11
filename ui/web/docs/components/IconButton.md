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
- `iconSize` (`number`, default `16`): Icon size in px.
- `size` (`"normal" | "small"`, default `"normal"`): Small is 22px, for close buttons in rows and tabs.
- `active` (`boolean`, default `false`): Pressed look and aria-pressed, for toggles.
- `type` (`"button" | "submit" | "reset"`, default `"button"`): The button's form type.
- `title` (`string`): Tooltip when it should differ from `label`.
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
