# PickList

A filterable list to pick one item: words filter, arrows move, Enter picks, Esc cancels.

```ts
import PickList from "@nibtree/ui/components/PickList.svelte";
```

Group: Navigation. Also known as: Command, Combobox, Quick pick.

## When to use

Use inside a Dialog for choosing a branch, a remote or a file. Pinned items always show.

## Props

- `items` (`PickItem<T>[] (logic/pickModel.ts)`, required): The choices, optionally grouped.
- `label` (`string`, required): Accessible name of the filter and list.
- `placeholder` (`string`, default `"Type to filter"`): Filter placeholder.
- `emptyText` (`string`, default `"Nothing matches"`): Shown when nothing matches.
- `query` (`string`, default `""`, bindable): The filter text.
- `onpick` (`(value: T) => void`, required): An item was picked.
- `oncancel` (`() => void`): Esc was pressed.

## Example: Checkout

```svelte
<PickList label="Branch" {items} onpick={checkout} />
```

## Replaces in the app

- `dialogs.pick({ title, items }) and its pick rows`

## Logic

- `logic/pickModel.ts`
