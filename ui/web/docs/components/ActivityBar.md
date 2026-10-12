# ActivityBar

The vertical icon bar beside a side panel; the open panel is tinted with an accent line.

```ts
import ActivityBar from "$ui/components/ActivityBar.svelte";
```

Group: Layout. Also known as: Sidebar.

## When to use

Use at the window's left or right edge. A `null` item pushes the rest to the bottom.

## Props

- `items` (`({ id; icon; label; badge?: number; dot?: boolean; smallIcon?: boolean } | null)[]`, required): The panels.
- `active` (`string | null`, default `null`, bindable): The open panel's id.
- `label` (`string`, required): Accessible name.
- `side` (`"left" | "right"`, default `"left"`): Which window edge; moves the border and accent line.
- `onselect` (`(id: string) => void`): A panel button was clicked.

## Example: Left bar

```svelte
<ActivityBar label="Side panels" {items} bind:active />
```

## Replaces in the app

- `<nav class="activity"> in ActivityBar.svelte and RightActivityBar.svelte`
