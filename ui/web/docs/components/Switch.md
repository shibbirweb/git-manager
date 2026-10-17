# Switch

An on/off switch for a setting that applies at once.

```ts
import Switch from "@nibtree/ui/components/Switch.svelte";
```

Group: Forms. Also known as: Switch, Toggle switch.

## When to use

Use in Settings rows and panels. Use Checkbox inside dialogs whose changes apply on OK.

## Props

- `checked` (`boolean`, default `false`, bindable): On or off.
- `label` (`string`, required): Accessible name, usually the setting's title.
- `disabled` (`boolean`, default `false`): Disables it.
- `onchange` (`(checked: boolean) => void`): Called with the new state.

## Example: Setting

```svelte
<Switch label="Word wrap" bind:checked={wrap} />
```

## Replaces in the app

- `<input type="checkbox" class="switch" />`
