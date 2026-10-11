# MenuButton

A button that opens a Menu under itself, like a "..." button.

```ts
import MenuButton from "$ui/components/MenuButton.svelte";
```

Group: Overlays. Also known as: Dropdown menu.

## When to use

Use for a short list of actions behind one button. With `text` it is a Button, otherwise an IconButton.

## Props

- `items` (`MenuItem (MenuCommand | MenuSubmenu | MenuSeparator, from logic/menuModel.ts)[]`, required): The entries.
- `label` (`string`, required): Accessible name and tooltip.
- `icon` (`IconName`, default `"more"`): The icon.
- `text` (`string`, default `""`): Show a text button instead of an icon button.
- `alignEnd` (`boolean`, default `false`): Line up the menu's right edge with the button's.
- `disabled` (`boolean`, default `false`): Disables the button.

## Example: More actions

```svelte
<MenuButton label="More actions" items={actions} alignEnd />
```

## Replaces in the app

- `contextMenu.openBelow(button, items)`

## Logic

- `logic/menuModel.ts`
