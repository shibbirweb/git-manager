# LoadingOverlay

A card over a dimmed window while something long happens: spinner, title, step and hint.

```ts
import LoadingOverlay from "@nibtree/ui/components/LoadingOverlay.svelte";
```

Group: Overlays.

## When to use

Use only for work that blocks the window, such as opening a big folder. Otherwise use Spinner.

## Props

- `open` (`boolean`, default `true`): Shown or hidden.
- `title` (`string`, required): What is happening.
- `step` (`string`, default `""`): The current step.
- `hint` (`string`, default `""`): A faint note.

## Example: Opening

```svelte
<LoadingOverlay title="Opening storefront" step="Reading repositories" />
```

## Replaces in the app

- `src/lib/views/OpeningProgress.svelte`
