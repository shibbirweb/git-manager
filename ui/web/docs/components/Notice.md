# Notice

A tinted banner with an icon, a message and an optional action on the right.

```ts
import Notice from "@git-manager/ui/components/Notice.svelte";
```

Group: Feedback. Also known as: Alert, Banner, Callout.

## When to use

Use inside a view for a state the user should know, such as a file changed on disk. Use a toast for events.

## Props

- `tone` (`"danger" | "warning" | "info" | "success"`, default `"info"`): Color and default icon.
- `variant` (`"card" | "banner"`, default `"card"`): A rounded card in a view, or a full-width bar at its top.
- `icon` (`IconName | null`, default `null`): Another icon than the tone's.
- `action` (`Snippet`): A button on the right.
- `children` (`Snippet`, required): The message.

## Example: With an action

```svelte
<Notice tone="danger">
  The file changed on disk.
  {#snippet action()}<Button size="small" onclick={reload}>Reload</Button>{/snippet}
</Notice>
```

## Replaces in the app

- `<div class="notice"><Icon name="alert" /><span>...</span></div>`
