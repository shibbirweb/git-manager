# ThemeSwatch

A color theme's preview chip: code on its background and bars of its main colors.

```ts
import ThemeSwatch from "$ui/components/ThemeSwatch.svelte";
```

Group: Feedback.

## When to use

Use in theme lists. The colors are the theme's own, so they come in as data.

## Props

- `colors` (`{ background; foreground; border; keyword; string; accent; selection: string }`, required): The theme's
  colors.
- `label` (`string`, required): The theme's name.

## Example: Theme

```svelte
<ThemeSwatch label="Monokai" colors={theme.swatch} />
```

## Replaces in the app

- `<span class="swatch"> in ColorThemePicker.svelte`
