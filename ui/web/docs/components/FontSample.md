# FontSample

A few lines of sample text in a chosen font, like Settings' editor and terminal previews.

```ts
import FontSample from "$ui/components/FontSample.svelte";
```

Group: Editor. Also known as: Font preview.

## When to use

Font, size, weight and spacing come from the user's settings, so they are data numbers here.

## Props

- `lines` (`{ text?; dim?; parts?: { text; dim?; bold? }[] }[]`, required): The sample's lines; a line of `parts` mixes
  dim and bold words.
- `label` (`string`, required): Accessible name.
- `variant` (`"editor" | "terminal"`, default `"editor"`): Editor spacing, or the terminal's line height.
- `fontFamily` (`string`): The font, from settings.
- `fontSize` (`number | null`, default `null`): Its size in px, from settings.
- `fontWeight` (`number | null`, default `null`): Its weight, from settings.
- `boldWeight` (`number | null`, default `null`): The weight of bold parts, from settings; else the bold token.
- `letterSpacing` (`number | null`, default `null`): Extra spacing in px, from settings.
- `lineHeight` (`number | null`, default `null`): The terminal's line height, from settings.
- `ligatures` (`boolean`, default `true`): Join ligatures.

## Example: Editor

```svelte
<FontSample label="Preview" lines={sample} fontFamily="JetBrains Mono" />
```

## Replaces in the app

- `.font-preview and .terminal-preview in SettingsDialog.svelte`
