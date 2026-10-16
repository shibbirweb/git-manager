# StatusBar

The bottom status bar: StatusItems on the left (repository, branch) and on the right.

```ts
import StatusBar from "@git-manager/ui/components/StatusBar.svelte";
```

Group: Layout.

## When to use

Use once per window at the bottom. Put StatusItems in `start` and `end`.

## Props

- `label` (`string`, default `"Status bar"`): Accessible name.
- `look` (`"flat" | "rounded"`, default `"flat"`): A line on top, or the window frame's color (rounded panels).
- `start` (`Snippet`): Items on the left; they clip when the window is narrow.
- `end` (`Snippet`): Items on the right.

## Example: Branch and memory

```svelte
<StatusBar>
  {#snippet start()}<StatusItem icon="branch" text="main" onclick={pick} />{/snippet}
  {#snippet end()}<StatusItem icon="memory" text="181 MB" />{/snippet}
</StatusBar>
```

## Replaces in the app

- `<footer class="status-bar"> in StatusBar.svelte`
