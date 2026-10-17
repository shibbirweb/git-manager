# PanelHeader

A panel's header: its title in small capitals on the left, its action buttons on the right.

```ts
import PanelHeader from "@nibtree/ui/components/PanelHeader.svelte";
```

Group: Layout.

## When to use

Use at the top of every side and bottom panel. Put IconButtons with size compact in `actions`.

## Props

- `title` (`string`, required): The panel's name; it shortens first when the panel is narrow.
- `count` (`number | null`, default `null`): A quiet count after the title, such as the number of changed files.
- `actions` (`Snippet`): Buttons on the right.

## Example: Changes panel

```svelte
<PanelHeader title="Changes">
  {#snippet actions()}
    <IconButton icon="refresh" label="Refresh" size="compact" iconSize="medium" />
  {/snippet}
</PanelHeader>
```

## Replaces in the app

- `PanelHead.svelte`
- `<header class="head"> in TerminalPanel.svelte`
- `<div class="head"> with its .count in ChangesView.svelte`
