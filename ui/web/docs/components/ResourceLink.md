# ResourceLink

A large row that opens something to read or do: icon, title and a line of description.

```ts
import ResourceLink from "@git-manager/ui/components/ResourceLink.svelte";
```

Group: Navigation. Also known as: Link card, Learn.

## When to use

Use for the Welcome page's Learn links.

## Props

- `icon` (`IconName`, required): The resource's icon.
- `title` (`string`, required): Its name.
- `description` (`string`, default `""`): One line about it.
- `variant` (`"plain" | "card"`, default `"plain"`): Plain (Welcome) or a bordered card (Settings' About).
- `onclick` (`() => void`, required): Pressed.

## Example: Docs

```svelte
<ResourceLink icon="book" title="Documentation" onclick={openWiki} />
```

## Replaces in the app

- `.learn-item in Welcome.svelte`
