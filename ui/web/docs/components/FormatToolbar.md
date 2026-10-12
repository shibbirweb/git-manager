# FormatToolbar

A row of formatting buttons above a text, in groups split by thin lines.

```ts
import FormatToolbar from "$ui/components/FormatToolbar.svelte";
```

Group: Editor. Also known as: Toolbar, Formatting.

## When to use

Use above a rich or Markdown editor. `null` in `items` starts a new group; a menu tool opens a Menu.

## Props

- `items` (`(FormatTool | null)[] ({ id; icon; label; disabled?; menu? })`, required): The tools in order.
- `label` (`string`, required): Accessible name.
- `onaction` (`(id: string, element: HTMLElement) => void`, required): A tool was pressed; the element anchors a menu.

## Example: Markdown

```svelte
<FormatToolbar label="Format" items={[bold, italic, null, link]} onaction={format} />
```

## Replaces in the app

- `src/lib/views/files/MarkdownToolbar.svelte`
