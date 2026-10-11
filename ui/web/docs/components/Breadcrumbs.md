# Breadcrumbs

A path as crumbs separated by chevrons, like the Navigation Bar; the file is bold.

```ts
import Breadcrumbs from "$ui/components/Breadcrumbs.svelte";
```

Group: Navigation. Also known as: Breadcrumb, Path bar.

## When to use

Use above an editor for the file's path. Open a list of a folder's files from `onselect`.

## Props

- `crumbs` (`{ label: string; icon?: IconName; kind?: "repo" | "folder" | "file" }[]`, required): The parts.
- `label` (`string`, default `"Path"`): Accessible name.
- `open` (`number | null`, default `null`): Index of the crumb whose list shows.
- `onselect` (`(index: number, element: HTMLElement) => void`): A crumb was clicked.

## Example: File path

```svelte
<Breadcrumbs crumbs={parts} onselect={(index, element) => list(index)} />
```

## Replaces in the app

- `<button class="crumb"> in NavigationBar.svelte`
