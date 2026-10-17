# DialogHead

A dialog's head with more than a title: an icon on a tinted tile, a subtitle and a close button.

```ts
import DialogHead from "@nibtree/ui/components/DialogHead.svelte";
```

Group: Overlays. Also known as: Dialog header.

## When to use

Dialog draws it from its icon, subtitle and panel variant; use it alone only in a custom dialog.

## Props

- `title` (`string`, required): The title.
- `titleId` (`string`): The heading's id, for aria-labelledby.
- `subtitle` (`string`, default `""`): A dim line under the title.
- `icon` (`IconName | null`, default `null`): An icon on a tinted tile.
- `iconTone` (`"accent" | "success" | "warning" | "danger"`, default `"accent"`): The tile's color.
- `size` (`"normal" | "panel" | "content"`, default `"normal"`): A normal dialog's head, a panel dialog's, or a split
  dialog's content head (Settings).
- `onclose` (`() => void`): Shows a close button (without an icon).

## Example: Update

```svelte
<DialogHead icon="cloud-download" title="Update available" subtitle="0.2.0" />
```

## Replaces in the app

- `.head in AskpassDialog, UpdateDialog, WhatsNewDialog, ShortcutsDialog, McpToolsDialog`
