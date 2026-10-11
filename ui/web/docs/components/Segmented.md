# Segmented

A row of mutually exclusive choices (a toggle group), like Light / Dark / System. Arrow keys move.

```ts
import Segmented from "$ui/components/Segmented.svelte";
```

Group: Actions. Also known as: Toggle group, Segmented control.

## When to use

Use for two to four short choices that apply at once. Use Select for longer lists and RadioGroup when each choice needs
a description.

## Props

- `options` (`{ value: T; label?: string; icon?: IconName; title?: string; disabled?: boolean }[]`, required): The
  choices; give `title` to icon-only ones.
- `value` (`T extends string`, required, bindable): The chosen value.
- `label` (`string`, required): Accessible name of the group.
- `disabled` (`boolean`, default `false`): Disables every choice.
- `onchange` (`(value: T) => void`): Called when the user picks another choice.

## Example: A setting

```svelte
<Segmented
  label="Theme"
  bind:value={theme}
  options={[
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ]}
/>
```

## Replaces in the app

- `<div class="segmented"><button class:on={...}>`
- `Settings choices such as theme and diff layout`

## Logic

- `logic/roving.ts`
