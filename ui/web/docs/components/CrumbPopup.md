# CrumbPopup

The list under a breadcrumb: a filter field, then the folder's entries in their git colors.

```ts
import CrumbPopup from "@git-manager/ui/components/CrumbPopup.svelte";
```

Group: Overlays. Also known as: Folder popup, Nav popup.

## When to use

Open it from Breadcrumbs' onselect and place it under the crumb.

## Props

- `entries` (`{ id; name; icon?; tone?; folder? }[]`, required): The entries.
- `query` (`string`, default `""`, bindable): The filter.
- `placeholder` (`string`, default `"Filter"`): The filter's placeholder.
- `message` (`string`, default `""`): Shown when there are no entries.
- `error` (`boolean`, default `false`): The message is an error.
- `label` (`string`, required): Accessible name.
- `onpick` (`(entry) => void`, required): An entry was picked.
- `onclose` (`() => void`): Escape.

## Example: A folder

```svelte
<CrumbPopup label="src" {entries} onpick={open} />
```

## Replaces in the app

- `.nav-popup in src/lib/navBar/NavigationBar.svelte`
