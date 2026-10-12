# Fieldset

A group of options under a legend, like Pull's choices of how to integrate changes.

```ts
import Fieldset from "$ui/components/Fieldset.svelte";
```

Group: Forms.

## When to use

Use around a RadioGroup or Checkboxes that answer one question in a dialog.

## Props

- `legend` (`string`, required): The question.
- `disabled` (`boolean`, default `false`): Disables every option inside.
- `legendTone` (`"faint" | "dim"`, default `"faint"`): Faint in dialogs; dim in a small form like Commit Options.
- `children` (`Snippet`, required): The options.

## Example: Pull

```svelte
<Fieldset legend="Integrate with">
  <RadioGroup ... layout="columns" />
</Fieldset>
```

## Replaces in the app

- `<fieldset class="modes"><legend class="hint"> in Pull, Reset, Update Project and more`
