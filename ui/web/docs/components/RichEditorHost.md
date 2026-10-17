# RichEditorHost

The page a rich Markdown editor (TipTap) is mounted into, in the preview's typography.

```ts
import RichEditorHost from "@nibtree/ui/components/RichEditorHost.svelte";
```

Group: Editor. Also known as: Rich editor, WYSIWYG.

## When to use

Create the editor on the element given to `onready`. Show loading in `status`, read-only in `notice`.

## Props

- `label` (`string`, required): Accessible name.
- `status` (`string`, default `""`): A line while it loads or fails.
- `notice` (`string`, default `""`): A warning, such as why the file is read-only.
- `onready` (`(element: HTMLDivElement) => void`, required): The element to mount the editor on.
- `variant` (`"editor" | "preview"`, default `"editor"`): The rich editor's page, or the read-only preview's (no editor
  rules).
- `page` (`HTMLDivElement | null`, default `null`, bindable): The scrolling page, to keep its scroll or focus it while
  read-only.
- `onclick` (`(event: MouseEvent) => void`): A click in the page, such as on a link.
- `onkeydown` (`(event: KeyboardEvent) => void`): A key in the page, such as Cmd+S.
- `onauxclick` (`(event: MouseEvent) => void`): A middle click in the page, such as on a link.
- `onscroll` (`(event: Event) => void`): The page scrolled, such as to scroll the source with it.

## Example: Rich

```svelte
<RichEditorHost label="README.md" onready={(element) => mount(element)} />
```

## Replaces in the app

- `src/lib/views/files/RichMarkdownView.svelte frame and styles`
