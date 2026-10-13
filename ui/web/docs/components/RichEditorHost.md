# RichEditorHost

The page a rich Markdown editor (TipTap) is mounted into, in the preview's typography.

```ts
import RichEditorHost from "@git-manager/ui/components/RichEditorHost.svelte";
```

Group: Editor. Also known as: Rich editor, WYSIWYG.

## When to use

Create the editor on the element given to `onready`. Show loading in `status`, read-only in `notice`.

## Props

- `label` (`string`, required): Accessible name.
- `status` (`string`, default `""`): A line while it loads or fails.
- `notice` (`string`, default `""`): A warning, such as why the file is read-only.
- `onready` (`(element: HTMLDivElement) => void`, required): The element to mount the editor on.

## Example: Rich

```svelte
<RichEditorHost label="README.md" onready={(element) => mount(element)} />
```

## Replaces in the app

- `src/lib/views/files/RichMarkdownView.svelte frame and styles`
