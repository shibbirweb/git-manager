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
- `hint` (`string`, default `""`): One sentence on what it does.
- `stacked` (`boolean`, default `false`): Control under the text, for wide controls.
- `hintContent` (`Snippet`): A rich hint (with a link) instead of `hint`.
- `children` (`Snippet`, required): The control.

## Example: Switch setting

```svelte
<SettingRow title="Word wrap" hint="Wrap long lines.">
  <Switch label="Word wrap" bind:checked={wrap} />
</SettingRow>
```

## Replaces in the app

- `<div class="row"><div class="label"><span>Title</span><span class="hint">...</span></div>...</div>`
