# Collapsible

A section whose header opens and closes it: chevron, bold title, count and hover actions.

```ts
import Collapsible from "$ui/components/Collapsible.svelte";
```

Group: Navigation. Also known as: Accordion, Collapsible, Disclosure.

## When to use

Use for groups in a list, like Staged Changes. Actions show while the header is hovered or focused.

## Props

- `title` (`string`, required): The group's name.
- `open` (`boolean`, default `true`, bindable): Open or closed.
- `count` (`number | null`, default `null`): A dim number after the title.
- `nested` (`boolean`, default `false`): Indent the header, for a group inside a repository.
- `actions` (`Snippet`): Small buttons on the right of the header.
- `ontoggle` (`(open: boolean) => void`): Called when the user opens or closes it.
- `children` (`Snippet`, required): The rows, shown while open.

## Example: Changes group

```svelte
<Collapsible title="Changes" count={files.length}>...</Collapsible>
```

## Replaces in the app

- `<div class="group-header"><button class="group-toggle"> in RepoSection.svelte`
