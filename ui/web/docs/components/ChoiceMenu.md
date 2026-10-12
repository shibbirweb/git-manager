# ChoiceMenu

A menu of one-of choices in a Popover: a title with its status, then radio choices and descriptions.

```ts
import ChoiceMenu from "$ui/components/ChoiceMenu.svelte";
```

Group: Overlays. Also known as: Radio menu, Mode picker.

## When to use

Use for a status bar setting with a few modes, such as Keep Awake. Arrow keys move, Enter picks.

## Props

- `title` (`string`, required): The bold heading.
- `status` (`string`, default `""`): The current state, dim on the right.
- `choices` (`{ value; label; description? }[]`, required): The modes.
- `value` (`T`, required, bindable): The chosen mode.
- `onchange` (`(value: T) => void`): A mode was picked.

## Example: Keep Awake

```svelte
<ChoiceMenu title="Keep Awake" status="Off" {choices} bind:value />
```

## Replaces in the app

- `.menu in src/lib/ai/KeepAwake.svelte`
