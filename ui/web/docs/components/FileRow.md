# FileRow

A changed file in a list: status letter, type icon, name, dim folder, tag and hover actions.

```ts
import FileRow from "@git-manager/ui/components/FileRow.svelte";
```

Group: Navigation.

## When to use

Use in the Changes list, commit details, shelf and compare views. `checked` adds a box for lists that pick files. Keep
actions to two or three icons.

## Props

- `kind` (`"added" | "modified" | "typechange" | "deleted" | "renamed" | "copied" | "untracked" | "conflicted" | null`,
  required): The change.
- `name` (`string`, required): The file name.
- `directory` (`string`, default `""`): The folder, dim after the name.
- `note` (`string`, default `""`): Dim text in brackets, such as the old name.
- `badge` (`string`, default `""`): A small outlined tag, such as LFS.
- `icon` (`{ kind: "image"; src: string } | { kind: "mask"; className: string } | null`, default `null`): The file's
  type icon.
- `selected` (`boolean`, default `false`): The selected row.
- `nested` (`boolean`, default `false`): Indent under a repository heading.
- `variant` (`"changes" | "list"`, default `"changes"`): The Changes panel's row, or a plain list of a branch's or
  commit's files (no indent, selected over hover).
- `checked` (`boolean | null`, default `null`, bindable): A checkbox when not null.
- `title` (`string`): Tooltip, such as the full path.
- `id` (`string`): Its element id, so a list can point screen readers at the selected row.
- `keepFocus` (`boolean`, default `false`): A click leaves the focus where it was, in a list that owns the keys.
- `actions` (`{ icon: IconName; title: string; danger?: boolean; run: () => void }[]`, default `[]`): Hover actions.
- `onselect` (`() => void`): Clicked.
- `onactivate` (`() => void`): Double-clicked or Enter.
- `oncontextmenu` (`(event: MouseEvent) => void`): Right-clicked, for its Menu.

## Example: A change

```svelte
<FileRow kind="modified" name="cart.ts" directory="src" {actions} />
```

## Replaces in the app

- `src/lib/views/changes/FileRow.svelte`
