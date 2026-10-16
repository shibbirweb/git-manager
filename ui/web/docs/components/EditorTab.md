# EditorTab

One tab of a TabStrip: icon, name, hint and close button (a dot while unsaved).

```ts
import EditorTab from "@git-manager/ui/components/EditorTab.svelte";
```

Group: Navigation.

## When to use

TabStrip draws these; use EditorTab alone only to build another strip with the same tabs.

## Props

- `tab` (`EditorTabData`, required): The tab's id, label, icon, hint and states (mono name, fixed).
- `active` (`boolean`, default `false`): The shown tab.
- `focused` (`boolean`, default `true`): The group has the focus.
- `layout` (`"scroll" | "wrap" | "single"`, default `"scroll"`): The strip's layout.
- `look` (`"flat" | "rounded"`, default `"flat"`): The strip's look.
- `lifted` (`boolean`, default `false`): Being dragged: floats above the others.
- `closable` (`boolean`, default `true`): Shows the close button.
- `onselect` (`() => void`): Clicked.
- `ondblclick` (`() => void`): Double-clicked.
- `onclose` (`() => void`): Close button or middle click.
- `onunpin` (`() => void`): A pinned tab's button unpins it.
- `oncontextmenu` (`(event: MouseEvent) => void`): Right-clicked.
- `onpointerdown` (`(event: PointerEvent) => void`): Pressed, to start a drag.

## Example: A tab

```svelte
<EditorTab tab={{ id: "a", label: "cart.ts", icon: "file" }} active />
```

## Replaces in the app

- `<div class="tab"> in EditorTabs.svelte`
