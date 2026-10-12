# Pane

A side column inside a view or dialog: a set width, its own scroll and a tinted background.

```ts
import Pane from "$ui/components/Pane.svelte";
```

Group: Layout. Also known as: Side column, Sidebar.

## When to use

Use for a list beside its content, such as Local History's versions.

## Props

- `label` (`string`, required): Accessible name.
- `width` (`"small" | "medium" | "large"`, default `"large"`): 140, 180 or 240 px.
- `side` (`"left" | "right"`, default `"left"`): Where it sits; the line goes on the other side.
- `line` (`"strong" | "soft"`, default `"strong"`): Its edge line; soft for the welcome screen's sidebar.
- `children` (`Snippet`, required): Its content.

## Example: Versions

```svelte
<Pane label="Versions">...</Pane>
```

## Replaces in the app

- `.versions in src/lib/localHistory/LocalHistoryDialog.svelte`
