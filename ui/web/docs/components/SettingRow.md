# SettingRow

A Settings row: title and hint on the left, the control on the right, or under them when stacked.

```ts
import SettingRow from "$ui/components/SettingRow.svelte";
```

Group: Forms.

## When to use

Use for every setting in Settings and in settings-like panels. Put one control in it.

## Props

- `title` (`string`, required): The setting's name.
- `titleMatches` (`[number, number][]`, default `[]`): Ranges [start, end) of the title a search found, in the warning
  tint (Settings search).
- `hint` (`string`, default `""`): One sentence on what it does.
- `stacked` (`boolean`, default `false`): Control under the text, for wide controls.
- `nested` (`boolean`, default `false`): Indented under the setting it belongs to.
- `plain` (`boolean`, default `false`): No line between rows and a regular label (welcome screen).
- `hintContent` (`Snippet`): A rich hint (with a link) instead of `hint`.
- `children` (`Snippet`, required): The control.

## Example: Switch setting

```svelte
<SettingRow title="Word wrap" hint="Wrap long lines.">
  <Switch label="Word wrap" bind:checked={wrap} />
</SettingRow>
```

## Example: Search matches

```svelte
<SettingRow title="Word wrap" titleMatches={[[0, 4]]}>
  <Switch label="Word wrap" bind:checked={wrap} />
</SettingRow>
```

## Replaces in the app

- `<div class="row"><div class="label"><span>Title</span><span class="hint">...</span></div>...</div>`
- `Settings search's CSS Custom Highlight (`::highlight(settings-search)`): pass the ranges instead`
