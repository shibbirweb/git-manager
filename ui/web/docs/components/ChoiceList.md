# ChoiceList

A few answers to pick from, each a card with a label and a line of description.

```ts
import ChoiceList from "@git-manager/ui/components/ChoiceList.svelte";
```

Group: Forms. Also known as: Choices, Option cards.

## When to use

Use in a dialog that asks how to do something. A danger choice has a red label.

## Props

- `choices` (`{ value; label; description?; danger? }[]`, required): The answers.
- `label` (`string`, required): Accessible name of the group.
- `onpick` (`(value: T) => void`, required): A choice was picked.

## Example: Stash

```svelte
<ChoiceList label="Apply stash" {choices} onpick={apply} />
```

## Replaces in the app

- `.choices in src/lib/ui/DialogHost.svelte ("choose" dialogs)`
