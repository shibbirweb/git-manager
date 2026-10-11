# StatusItem

One status bar item: an icon and short text; a button when it has `onclick`.

```ts
import StatusItem from "$ui/components/StatusItem.svelte";
```

Group: Layout.

## When to use

Use inside StatusBar. Keep the text to a word or two; put details in a Popover.

## Props

- `text` (`string`, default `""`): Short text after the icon.
- `icon` (`IconName | null`, default `null`): The icon.
- `label` (`string`): Accessible name when the text alone is not enough.
- `title` (`string`): Tooltip.
- `tone` (`"default" | "accent" | "warning" | "danger"`, default `"default"`): Color, e.g. danger for conflicts.
- `open` (`boolean`, default `false`): Highlighted while its popover shows.
- `onclick` (`(event: MouseEvent) => void`): Makes it a button.

## Example: Branch

```svelte
<StatusItem icon="branch" text="main" onclick={openBranches} />
```

## Replaces in the app

- `<button class="item"> in StatusBar.svelte`
