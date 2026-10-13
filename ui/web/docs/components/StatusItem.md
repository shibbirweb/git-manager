# StatusItem

One status bar item: an icon and short text; a button when it has `onclick`.

```ts
import StatusItem from "@git-manager/ui/components/StatusItem.svelte";
```

Group: Layout.

## When to use

Use inside StatusBar. Keep the text to a word or two; put details in a Popover.

## Props

- `text` (`string`, default `""`): Short text after the icon.
- `leading` (`Snippet`): Before the icon, such as a Mark and a mini Meter (AI usage).
- `trailing` (`Snippet`): After the text, such as a small Badge (notifications) or a StatusDot.
- `icon` (`IconName | null`, default `null`): The icon.
- `label` (`string`): Accessible name when the text alone is not enough.
- `title` (`string`): Tooltip.
- `tone` (`"default" | "accent" | "warning" | "danger"`, default `"default"`): Color, e.g. danger for conflicts.
- `spin` (`boolean`, default `false`): The icon turns, while work runs.
- `variant` (`"default" | "quiet"`, default `"default"`): Quiet: 11px dim words, like Keep Awake.
- `active` (`boolean`, default `false`): A quiet item that is on: its words brighten.
- `disabled` (`boolean`, default `false`): Cannot be pressed now, such as Sync while another job runs.
- `limit` (`"none" | "branch" | "operation"`, default `"none"`): Truncate the text at 200 or 320 px.
- `open` (`boolean`, default `false`): Highlighted while its popover shows.
- `onclick` (`(event: MouseEvent) => void`): Makes it a button.

## Example: Branch

```svelte
<StatusItem icon="branch" text="main" onclick={openBranches} />
```

## Replaces in the app

- `<button class="item"> in StatusBar.svelte`
