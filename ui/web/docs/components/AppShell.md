# AppShell

The window layout: header, activity bars, resizable side panels, editor area, bottom panel, status bar.

```ts
import AppShell from "$ui/components/AppShell.svelte";
```

Group: Layout. Also known as: Layout, Workspace, Window.

## When to use

Use once per window. Each region is a snippet; leave one out to hide it. Panel sizes are data the user drags, bound so
the app can store them; the editor area keeps its minimum width and height.

## Props

- `look` (`"flat" | "rounded"`, default `"flat"`): Lines between panels, or rounded panels on the window color.
- `height` (`"fill" | "small" | "medium" | "large"`, default `"fill"`): Fill the parent, or 160, 240 or 360 px.
- `sidebarWidth` (`number`, default `260`, bindable): The left panel's width.
- `rightWidth` (`number`, default `260`, bindable): The right panel's width.
- `bottomHeight` (`number`, default `260`, bindable): The bottom panel's height.
- `sidebarLabel` (`string`, default `"Resize sidebar"`): The left handle's name.
- `rightLabel` (`string`, default `"Resize right sidebar"`): The right handle's name.
- `bottomLabel` (`string`, default `"Resize bottom panel"`): The bottom handle's name.
- `oncommit` (`() => void`): A drag ended: store the sizes.
- `header` (`Snippet`): The top bar.
- `banners` (`Snippet`): Notices under the header.
- `leftBar` (`Snippet`): The left ActivityBar.
- `sidebar` (`Snippet`): The left panel.
- `editor` (`Snippet`, required): The editor area.
- `bottom` (`Snippet`): The bottom panel, such as the terminal.
- `right` (`Snippet`): The right panel.
- `rightBar` (`Snippet`): The right ActivityBar.
- `statusBar` (`Snippet`): The StatusBar.

## Example: The window

```svelte
<AppShell bind:sidebarWidth {editor} {sidebar} {statusBar} oncommit={save} />
```

## Replaces in the app

- `the layout and styles of src/lib/views/Workspace.svelte`

## Logic

- `logic/shellLayout.ts`
