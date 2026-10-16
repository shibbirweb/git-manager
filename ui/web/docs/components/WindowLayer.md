# WindowLayer

A modal page over the whole window, with no dimming or frame; its content fills it as a column.

```ts
import WindowLayer from "@git-manager/ui/components/WindowLayer.svelte";
```

Group: Overlays. Also known as: Full-screen overlay, Modal page.

## When to use

Use for a tool that takes the whole window for a while, such as the merge tool: a Toolbar with its title and a close
button, then the view. The content handles Esc, so leaving can ask first.

## Props

- `label` (`string`, required): Accessible name, such as the file being merged.
- `children` (`Snippet`, required): A Toolbar and a growing view.

## Rules

- Give the content its own close button: there is no dim area to click and Esc is the content's.

## Example: The merge tool

```svelte
<WindowLayer label="Merge src/app.ts">
  <Toolbar variant="tab" label="Merge">...</Toolbar>
  <MergeEditor {doc} />
</WindowLayer>
```

## Replaces in the app

- `<div class="overlay" role="dialog"> covering the window in merge/MergeView.svelte`
