# Tile

A big start action: its icon on a rounded tile and its name under it.

```ts
import Tile from "@nibtree/ui/components/Tile.svelte";
```

Group: Actions. Also known as: Start action, Big button.

## When to use

Use for the Welcome page's Open, Clone and New. The tile turns accent on hover and focus.

## Props

- `icon` (`IconName`, required): The action's icon.
- `label` (`string`, required): The action's name.
- `title` (`string`): A tooltip.
- `onclick` (`() => void`, required): Pressed.

## Example: Open

```svelte
<Tile icon="folder" label="Open" onclick={open} />
```

## Replaces in the app

- `.tile in Welcome.svelte`
