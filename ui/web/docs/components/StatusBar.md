# StatusBar

The bottom status bar: StatusItems on the left (repository, branch) and on the right.

```ts
import StatusBar from "$ui/components/StatusBar.svelte";
```

Group: Layout.

## When to use

Use once per window at the bottom. Put StatusItems in `start` and `end`.

## Props

- `label` (`string`, default `"Status bar"`): Accessible name.
- `start` (`Snippet`): Items on the left.
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
