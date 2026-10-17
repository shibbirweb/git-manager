# Breadcrumbs

A path as crumbs separated by chevrons, like the Navigation Bar; the file is bold.

```ts
import Breadcrumbs from "@nibtree/ui/components/Breadcrumbs.svelte";
```

Group: Navigation. Also known as: Breadcrumb, Path bar.

## When to use

Use above an editor for the file's path. Open a list of a folder's files from `onselect`; crumbElement(index) gives a
crumb's button to open its list from the keyboard.

## Props

- `crumbs` (`{ label: string; icon?: IconName; fileIcon?: FileIconView; kind?: "repo" | "folder" | "file" }[]`,
  required): The parts; the farthest shorten first when narrow.
- `label` (`string`, default `"Path"`): Accessible name.
- `open` (`number | null`, default `null`): Index of the crumb whose list shows.
- `variant` (`"inline" | "floating" | "anchored"`, default `"inline"`): In a bar; floating over the editor; or under the
  tabs, anchored to the editor's top.
- `at` (`{ top: number; left: number; maxWidth: number } | null`, default `null`): Anchored: where the bar sits, such as
  the focused editor's top left.
- `title` (`string`): A tooltip, such as the full path.
- `element` (`HTMLElement | null`, default `null`, bindable): The bar, for a click-outside check.
- `onselect` (`(index: number, element: HTMLElement) => void`): A crumb was clicked.

## Example: File path

```svelte
<Breadcrumbs crumbs={parts} onselect={(index, element) => list(index)} />
```

## Replaces in the app

- `<button class="crumb"> in NavigationBar.svelte`
