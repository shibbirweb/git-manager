# ToggleButton

A button that stays on or off, such as Collapse unchanged in the diff or the merge editor's options.

```ts
import ToggleButton from "$ui/components/ToggleButton.svelte";
```

Group: Actions. Also known as: Toggle, Pressed button.

## When to use

Use plain in editor toolbars (borderless, tinted when on) and outline for options that stand out (merge editor). Without
`text` it is a narrow icon button named by `label`.

## Props

- `pressed` (`boolean`, default `false`, bindable): On or off.
- `label` (`string`, required): Accessible name, and the tooltip without `title`.
- `text` (`string`, default `""`): Visible words.
- `icon` (`IconName | null`, default `null`): An icon before the words.
- `variant` (`"plain" | "outline" | "tool" | "chip" | "filter"`, default `"plain"`): Borderless, outlined, a toolbar
  icon, a chip, or a filter that turns accent when on.
- `disabled` (`boolean`, default `false`): Cannot be pressed.
- `title` (`string`): A longer tooltip.
- `keepFocus` (`boolean`, default `false`): Pressing it leaves the focus where it was, such as in a search field.
- `onchange` (`(pressed: boolean) => void`): Called after each press.

## Example: Diff

```svelte
<ToggleButton icon="list-tree" label="Collapse unchanged" bind:pressed />
```

## Replaces in the app

- `<button class="toggle"> in DiffView.svelte and MergeEditor.svelte`
