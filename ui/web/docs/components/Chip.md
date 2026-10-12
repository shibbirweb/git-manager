# Chip

A small rounded button with a word or two: a filter summary or a value to pick.

```ts
import Chip from "$ui/components/Chip.svelte";
```

Group: Actions. Also known as: Chip, Filter pill.

## When to use

filter: sums up and filters a list (AI panel). pick: offers a value, such as a font in its own face.

## Props

- `text` (`string`, required): The words.
- `variant` (`"filter" | "pick" | "badge"`, default `"filter"`): A filter, a value to pick, or a small bordered fact.
- `tone` (`"neutral" | "warning"`, default `"neutral"`): Warning for something waiting on you.
- `icon` (`IconName | null`, default `null`): An icon before the words.
- `fontFamily` (`string`): Shows the words in this font (font picks); data, not design.
- `title` (`string`): A tooltip.
- `onclick` (`() => void`): Makes it a button.

## Example: Font pick

```svelte
<Chip variant="pick" text="JetBrains Mono" fontFamily="JetBrains Mono" />
```

## Replaces in the app

- `.pill in AiPanel`
- `.font-pick in SettingsDialog`
