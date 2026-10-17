# CrumbPopup

The list under a breadcrumb: a filter field, then the folder's entries in their git colors.

```ts
import CrumbPopup from "@nibtree/ui/components/CrumbPopup.svelte";
```

Group: Overlays. Also known as: Folder popup, Nav popup.

## When to use

Open it from Breadcrumbs' onselect and place it under the crumb.

## Props

- `entries` (`{ id; name; ranges?; icon?; fileIcon?; tone?; folder?; title? }[]`, required): The entries.
- `query` (`string`, default `""`, bindable): The filter.
- `selected` (`number`, default `0`, bindable): The highlighted entry.
- `placeholder` (`string`, default `"Filter"`): The filter's placeholder.
- `message` (`string`, default `""`): Shown when there are no entries.
- `error` (`boolean`, default `false`): The message is an error.
- `note` (`string`, default `""`): A faint line under the entries, such as that only the first 5000 show.
- `anchor` (`HTMLElement | null`, default `null`): Its crumb: the list floats over the window under it, or above it near
  the bottom.
- `label` (`string`, required): Accessible name.
- `onpick` (`(entry, event: KeyboardEvent | MouseEvent) => void`, required): An entry was picked; Cmd may open to the
  side.
- `onkeydown` (`(event: KeyboardEvent) => void`): Runs first; preventDefault keeps a key from the list (Right goes into
  a folder, Left out).
- `onclose` (`() => void`): Escape.

## Example: A folder

```svelte
<CrumbPopup label="src" {entries} onpick={open} />
```

## Replaces in the app

- `.nav-popup in src/lib/navBar/NavigationBar.svelte`
