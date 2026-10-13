# FloatingFindBar

A find bar floating over a view that is not an editor, such as the terminal.

```ts
import FloatingFindBar from "@git-manager/ui/components/FloatingFindBar.svelte";
```

Group: Editor. Also known as: Find, Search box.

## When to use

Use over terminals and previews. The editor's own find bar (with replace) is FindBar.

## Props

- `query` (`string`, default `""`, bindable): What to find.
- `options` (`SearchOptions`, default `all off`, bindable): Match case, whole words, regex.
- `counter` (`string`, default `""`): Such as 2 of 5.
- `problem` (`boolean`, default `false`): No match or a bad regex: tints it red.
- `label` (`string`, default `"Find"`): Accessible name.
- `element` (`HTMLInputElement | null`, default `null`, bindable): The field, for focus.
- `onsearch` (`(query: string, options: SearchOptions) => void`): The query or options changed.
- `onnext` (`() => void`): Enter or the down button.
- `onprevious` (`() => void`): Shift+Enter or the up button.
- `onclose` (`() => void`): Esc or the close button.

## Example: Terminal

```svelte
<FloatingFindBar bind:query counter={counter} onnext={next} onclose={close} />
```

## Replaces in the app

- `src/lib/terminal/TerminalFindBar.svelte`
