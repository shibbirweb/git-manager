# TabStrip

The editor's tab strip: icon, name, hint and a close button; a dot for unsaved edits, italic previews.

```ts
import TabStrip from "$ui/components/TabStrip.svelte";
```

Group: Navigation. Also known as: Tabs, Editor tabs.

## When to use

Use above an editor group. Gray the active tab's accent line with `focused={false}` when another group has the focus.
Put a + button in `trailing`.

## Props

- `tabs` (`{ id: string; label: string; icon?: IconName; hint?: string; title?: string; preview?: boolean; dirty?:
  boolean; pinned?: boolean }[]`, required): The tabs in order.
- `active` (`string | null`, default `null`, bindable): The active tab's id.
- `label` (`string`, required): Accessible name of the strip.
- `focused` (`boolean`, default `true`): The group has the focus: accent line instead of gray.
- `onselect` (`(id: string) => void`): A tab was clicked.
- `onclose` (`(id: string) => void`): Close button or middle click; without it there is no close button.
- `oncontextmenu` (`(id: string, event: MouseEvent) => void`): Right-click on a tab, for its Menu.
- `trailing` (`Snippet`): Content after the last tab, such as a + IconButton.

## Example: Editor tabs

```svelte
<TabStrip label="Editor tabs" {tabs} bind:active onclose={closeTab} />
```

## Replaces in the app

- `<div class="tab-strip"> in EditorTabs.svelte`
