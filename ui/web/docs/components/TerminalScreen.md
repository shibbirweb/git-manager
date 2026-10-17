# TerminalScreen

The frame of a terminal: the element an xterm view opens in, its states, bell flash and drop outline.

```ts
import TerminalScreen from "@nibtree/ui/components/TerminalScreen.svelte";
```

Group: Editor. Also known as: Terminal frame, xterm host.

## When to use

Use when the app owns its terminals (addons, flow control, moving them between panels): open xterm in the element given
to `onready` and return the cleanup. TerminalView is built on it for a plain terminal. Overlays such as a
FloatingFindBar or a CornerCard go in `children`.

## Props

- `id` (`string`): Its element id, so the app can find a terminal's screen, such as for a file drop.
- `height` (`"fill" | "small" | "medium" | "large"`, default `"fill"`): Fill the parent, or 160, 240 or 360 px.
- `hidden` (`boolean`, default `false`): Out of sight and out of the layout, such as a terminal in another tab.
- `status` (`"starting" | "ready" | "failed"`, default `"ready"`): Starting shows a spinner, failed a message.
- `message` (`string`, default `""`): The starting or failed text.
- `detail` (`string`, default `""`): Why it failed, selectable.
- `ligatures` (`boolean`, default `false`): Join ligatures (=>, !=) in fonts that have them.
- `dropTarget` (`boolean`, default `false`): Files are dragged over it: an accent outline.
- `bell` (`number`, default `0`): A bell counter; each new value flashes the screen once.
- `element` (`HTMLDivElement | null`, default `null`, bindable): The screen's element, for events the app sends to it.
- `onready` (`(host: HTMLDivElement) => void | (() => void)`): The element to open xterm in; may return a cleanup.
- `onretry` (`() => void`): Shows Retry in the failed state.
- `oncontextmenu` (`(event: MouseEvent) => void`): Right-click, for the terminal's Menu.
- `onfocusin` (`(event: FocusEvent) => void`): The terminal took the focus.
- `children` (`Snippet`): Overlays such as the find bar.

## Rules

- Colors come from the --term-* tokens; never pass an xterm theme.

## Example: An app's terminal

```svelte
<TerminalScreen status={phase} onready={(host) => open(host)} />
```

## Replaces in the app

- `src/lib/terminal/TerminalView.svelte frame, states, bell and drop outline`
