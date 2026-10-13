# Slider

A range slider with its value on the right, like Settings' font size.

```ts
import Slider from "$ui/components/Slider.svelte";
```

Group: Forms. Also known as: Slider, Range.

## When to use

Use for a number in a known range where the exact value matters less than the feel.

## Props

- `value` (`number`, required, bindable): The value.
- `min` (`number`, required): Lowest value.
- `max` (`number`, required): Highest value.
- `step` (`number`, default `1`): Step between values.
- `label` (`string`, required): Accessible name.
- `disabled` (`boolean`, default `false`): Disables it.
- `valueWidth` (`"normal" | "wide"`, default `"normal"`): Room for the value: wide for words such as a font weight.
- `format` (`(value: number) => string`, default `(shown) => String(shown)`): How the value is shown, e.g. `13 px`.
- `resetValue` (`number | null`, default `null`): Double-click puts this value back (Settings' font weight).
- `onchange` (`(value: number) => void`): Called while it moves.

## Example: Font size

```svelte
<Slider label="Font size" bind:value={size} min={10} max={24} format={(value) => `${value} px`} />
```

## Replaces in the app

- `<div class="range"><input type="range" /><span class="value">...</span></div>`
