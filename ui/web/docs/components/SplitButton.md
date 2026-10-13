# SplitButton

A main action joined to a menu of related actions, like Commit with Commit and Push.

```ts
import SplitButton from "@git-manager/ui/components/SplitButton.svelte";
```

Group: Actions. Also known as: Button group.

## When to use

Use when one action is the usual choice and a few close variants exist.

## Props

- `text` (`string`, required): The main action.
- `items` (`MenuItem[]`, required): The related actions.
- `menuLabel` (`string`, required): The arrow's accessible name.
- `variant` (`"default" | "primary"`, default `"primary"`): Weight.
- `size` (`"normal" | "small"`, default `"normal"`): Height.
- `icon` (`IconName | null`, default `null`): An icon before the text.
- `disabled` (`boolean`, default `false`): Disables both parts.
- `onclick` (`() => void`, required): The main action.

## Example: Commit

```svelte
<SplitButton text="Commit" menuLabel="More" {items} onclick={commit} />
```

## Replaces in the app

- `<span class="split"> in CommitBox.svelte`

## Logic

- `logic/menuModel.ts`
