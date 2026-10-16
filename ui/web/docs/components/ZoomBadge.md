# ZoomBadge

A floating badge at the top of the window that shows a value for a moment, such as the zoom level.

```ts
import ZoomBadge from "@git-manager/ui/components/ZoomBadge.svelte";
```

Group: Feedback. Also known as: Zoom, HUD.

## When to use

Show it after the value changes and hide it after a second.

## Props

- `open` (`boolean`, default `true`): Shown or hidden.
- `text` (`string`, required): The value, such as 110%.

## Example: Zoom

```svelte
<ZoomBadge open={zoomShown} text="110%" />
```

## Replaces in the app

- `.zoom-badge in App.svelte`
