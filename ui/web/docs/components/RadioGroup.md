# RadioGroup

Native radio buttons for one choice among a few, each with an optional description.

```ts
import RadioGroup from "@nibtree/ui/components/RadioGroup.svelte";
```

Group: Forms. Also known as: Radio group.

## When to use

Use when each choice needs a sentence. Use Segmented for short labels without descriptions.

## Props

- `options` (`{ value: T extends string; label: string; description?: string; disabled?: boolean; danger?: boolean }[]`,
  required): The choices.
- `value` (`T extends string`, required, bindable): The chosen value.
- `name` (`string`, required): The radio group's form name; unique on the page.
- `label` (`string`, required): Accessible name of the group.
- `labelWidth` (`"small" | "medium" | "large"`, default `"large"`): The label column in columns layout: 100, 120 or 130
  px.
- `direction` (`"column" | "row"`, default `"column"`): Stack or line up the choices.
- `layout` (`"stacked" | "columns"`, default `"stacked"`): Description under the label, or label and description in
  columns (Pull's modes).
- `onchange` (`(value: T) => void`): Called with the new value.

## Example: Identity scope

```svelte
<RadioGroup label="Scope" name="scope" bind:value={scope} options={scopes} />
```

## Replaces in the app

- `<label><input type="radio" name="..." bind:group={...} /> ...</label>`
