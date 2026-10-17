# ListRegion

A focusable listbox the app fills with grouped content and drives with its own keys.

```ts
import ListRegion from "@nibtree/ui/components/ListRegion.svelte";
```

Group: Navigation. Also known as: Listbox, Grouped list, Active descendant.

## When to use

Use when a list is not one flat set of items, such as the Changes panel: repository headers, folding groups and a commit
box between the rows. It keeps the focus, so selected Rows inside show the strong color. The app handles the keys in
`onkeydown`, gives each row an id and passes the current one as `activeId`; `focus()` takes the focus after a click and
`reveal()` scrolls the current row into view. For a flat list use List, which owns the keys itself.

## Props

- `label` (`string`, required): Accessible name.
- `role` (`"listbox" | "tree"`, default `"listbox"`): A list of rows, or a tree whose rows fold (the AI panel's
  projects).
- `busy` (`boolean`, default `false`): Tells screen readers it is loading.
- `activeId` (`string`): The id of the row screen readers read as the current one.
- `paddingY` (`"none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl"`, default
  `"none"`): Space above the first row and under the last.
- `onkeydown` (`(event: KeyboardEvent) => void`): Keys pressed while it or something inside has the focus.
- `children` (`Snippet`, required): The rows and groups.

## Rules

- Give every selectable row a unique id, and keep `activeId` on a row that is drawn.

## Example: The Changes list

```svelte
<ListRegion label="Changed files" activeId={rowId} paddingY="xs" {onkeydown} bind:this={list}>
  {#each sections as section}<RepoSection {section} />{/each}
</ListRegion>
```

## Replaces in the app

- `<div class="file-list" role="listbox" tabindex="0"> in ChangesView.svelte`
