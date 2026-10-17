# OptionList

A bordered list to pick one option from, in groups, like Settings' color themes.

```ts
import OptionList from "@nibtree/ui/components/OptionList.svelte";
```

Group: Forms. Also known as: Listbox, Theme list.

## When to use

Draw each option in `option` (a ThemeSwatch and a name). The arrows, Home, End and the page keys move, and the picked
option stays in view.

## Props

- `groups` (`{ label; options: T[] }[]`, required): The groups.
- `optionKey` (`(option: T) => string`, required): An option's id.
- `value` (`string | null`, default `null`, bindable): The picked option's id.
- `label` (`string`, required): Accessible name.
- `option` (`Snippet<[T]>`, required): Draws an option.
- `onpick` (`(option: T) => void`): An option was picked.

## Example: Themes

```svelte
<OptionList label="Theme" {groups} optionKey={(t) => t.id} bind:value {option} />
```

## Replaces in the app

- `.list and .option in src/lib/views/settings/ColorThemePicker.svelte`

## Logic

- `logic/optionMove.ts`
