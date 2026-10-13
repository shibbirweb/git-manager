# Select

A native drop-down list, styled like Input.

```ts
import Select from "@git-manager/ui/components/Select.svelte";
```

Group: Forms. Also known as: Select, Native select.

## When to use

Use for five or more choices, or long labels. Use Segmented for two to four short choices.

## Props

- `options` (`{ value: T extends string; label: string; disabled?: boolean; title?: string }[]`, required): The choices;
  `title` is a tooltip for one, such as what a rebase action does.
- `value` (`T extends string`, required, bindable): The chosen value.
- `label` (`string`, required): Accessible name.
- `disabled` (`boolean`, default `false`): Disables it.
- `size` (`"normal" | "small"`, default `"normal"`): Small: 24px, inside a settings line.
- `width` (`"auto" | "fill" | "xsmall" | "small" | "medium" | "large"`, default `"auto"`): auto, the parent's width, or
  80, 120, 180 or 280 px.
- `onchange` (`(value: T) => void`): Called with the new value.

## Example: Cursor style

```svelte
<Select label="Cursor style" bind:value={cursor} options={[{ value: "bar", label: "Bar" }]} />
```

## Replaces in the app

- `<select class="input select">`
