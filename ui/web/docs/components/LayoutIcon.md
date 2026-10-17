# LayoutIcon

The drawn layout glyphs: a window with its left or right sidebar, and the commit box layouts.

```ts
import LayoutIcon from "@nibtree/ui/components/LayoutIcon.svelte";
```

Group: Actions.

## When to use

Use in the header's sidebar toggles and the Changes title bar's layout switch.

## Props

- `kind` (`"sidebar-left" | "sidebar-right" | "commit-single" | "commit-per-repo"`, required): Which glyph.
- `active` (`boolean`, default `false`): Fills the sidebar while it is shown.
- `size` (`IconSize`, default `"large"`): A named icon size.

## Example: Toggle

```svelte
<LayoutIcon kind="sidebar-left" active={sidebarShown} />
```

## Replaces in the app

- `src/lib/views/LayoutToggleIcon.svelte`
- `src/lib/views/changes/CommitLayoutIcon.svelte`
