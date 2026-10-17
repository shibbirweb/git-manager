# SidebarRow

A sidebar row for branches, tags, stashes and worktrees, or a small-caps group heading.

```ts
import SidebarRow from "@nibtree/ui/components/SidebarRow.svelte";
```

Group: Navigation.

## When to use

Use in the sidebar's lists. Give `expanded` to groups; put row buttons in `actions` (shown on hover).

## Props

- `label` (`string`, required): The name.
- `depth` (`"none" | "one" | "two" | "three"`, default `"none"`): Indent level, 12 px each; a row without a chevron
  lines up with its group's names.
- `icon` (`IconName | null`, default `null`): The icon.
- `current` (`boolean`, default `false`): The current branch: the icon in the accent color.
- `strong` (`boolean`, default `false`): A bold name.
- `section` (`boolean`, default `false`): A group heading in small capitals.
- `expanded` (`boolean | null`, default `null`): Open or closed for a group; null for a leaf.
- `count` (`number | null`, default `null`): How many items a group holds.
- `ahead` (`number`, default `0`): Commits ahead of the upstream.
- `behind` (`number`, default `0`): Commits behind the upstream.
- `path` (`string`, default `""`): A dim path after the name, such as a worktree's folder.
- `detail` (`string`, default `""`): Faint text at the end, such as a stash's ref.
- `gone` (`boolean`, default `false`): The upstream is gone: the name struck through.
- `selected` (`boolean`, default `false`): The selected row.
- `title` (`string`): Tooltip.
- `actions` (`Snippet`): Row buttons, shown on hover.
- `onclick` (`() => void`): A leaf was clicked.
- `ondblclick` (`() => void`): Double-clicked, such as Checkout.
- `oncontextmenu` (`(event: MouseEvent) => void`): Right-clicked.
- `ontoggle` (`() => void`): A group was opened or closed.

## Example: Current branch

```svelte
<SidebarRow label="main" icon="branch" current ahead={2} />
```

## Replaces in the app

- `src/lib/views/sidebar/RowContent.svelte and .sidebar-row in Sidebar.svelte`
