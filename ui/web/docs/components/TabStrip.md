# TabStrip

The editor's tab strip: icon, name, hint and a close button; a dot for unsaved edits, italic previews.

```ts
import TabStrip from "@git-manager/ui/components/TabStrip.svelte";
```

Group: Navigation. Also known as: Tabs, Editor tabs.

## When to use

Use above an editor group. Gray the active tab's accent line with `focused={false}` when another group has the focus.
Put a + button in `trailing`. The active tab is kept in view and the wheel scrolls one row sideways. With `onreorder`, a
dragged tab follows the pointer while the others slide aside; Escape cancels.

## Props

- `tabs` (`{ id: string; label: string; icon?: IconName; iconTone?: success|danger|dim; hint?: string; title?: string;
  preview?: boolean; dirty?: boolean; pinned?: boolean; mono?: boolean; fixed?: boolean }[]`, required): The tabs in
  order; `iconTone` colors a run's state, `mono` names a commit, `fixed` (the Diff tab) is never dragged.
- `active` (`string | null`, default `null`, bindable): The active tab's id.
- `label` (`string`, required): Accessible name of the strip.
- `focused` (`boolean`, default `true`): The group has the focus: accent line instead of gray.
- `layout` (`"scroll" | "wrap" | "single"`, default `"scroll"`): One scrolling row, wrapped rows, or a lone centered
  name.
- `look` (`"flat" | "rounded"`, default `"flat"`): Square tabs on the panel color, or rounded tabs on the editor color
  (rounded panels).
- `newLabel` (`string`, default `"New tab"`): The + button's name and tooltip.
- `onselect` (`(id: string) => void`): A tab was clicked.
- `ondblclick` (`(id: string) => void`): A tab was double-clicked, such as to keep a preview tab open.
- `onclose` (`(id: string) => void`): Close button or middle click; without it there is no close button.
- `onunpin` (`(id: string) => void`): A pinned tab's pin button unpins it; middle click still closes.
- `oncontextmenu` (`(id: string, event: MouseEvent) => void`): Right-click on a tab, for its Menu.
- `onnew` (`(event: MouseEvent) => void`): Shows a + after the tabs; open a Menu from it.
- `onreorder` (`(from: number, to: number) => void`): Tabs can be dragged; called with the move.
- `trailing` (`Snippet`): More content after the tabs.

## Example: Editor tabs

```svelte
<TabStrip label="Editor tabs" {tabs} bind:active onclose={closeTab} />
```

## Replaces in the app

- `<div class="tab-strip"> in EditorTabs.svelte`

## Logic

- `logic/tabDrag.ts`
- `logic/slide.ts`
- `logic/reorder.ts`
