# ListBox

A bordered, scrolling box on the editor background holding a list inside a dialog.

```ts
import ListBox from "@nibtree/ui/components/ListBox.svelte";
```

Group: Layout. Also known as: List container, Box.

## When to use

Use for a push's commits or the remotes; rows draw their own lines and the last one has none.

## Props

- `label` (`string`, required): Accessible name.
- `maxHeight` (`"none" | "small" | "medium" | "large"`, default `"none"`): Scrolls past 160, 240 or 360 px.
- `minHeight` (`"none" | "list"`, default `"none"`): Keeps room for a loading or empty state.
- `children` (`Snippet`, required): The rows.

## Example: Remotes

```svelte
<ListBox label="Remotes">{#each remotes as remote}<Text>{remote.name}</Text>{/each}</ListBox>
```

## Replaces in the app

- `.commits in PushDialog.svelte`
- `.remotes in RemotesDialog.svelte`
