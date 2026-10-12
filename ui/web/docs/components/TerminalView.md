# TerminalView

A terminal screen: xterm.js in the theme's terminal colors, with starting and failed states.

```ts
import TerminalView from "$ui/components/TerminalView.svelte";
```

Group: Editor. Also known as: Terminal, Console, xterm.

## When to use

Use to show a shell. It runs none: write output to the terminal given to `onready`, send `oninput` to the shell and
`onresize` to its size. Put the find bar and other overlays in `children`. A user's font size setting is applied to the
terminal in `onready`.

## Props

- `label` (`string`, required): Accessible name of the input.
- `height` (`"fill" | "small" | "medium" | "large"`, default `"fill"`): Fill the parent, or 160, 240 or 360 px.
- `status` (`"starting" | "ready" | "failed"`, default `"ready"`): Starting shows a spinner, failed a message.
- `message` (`string`, default `""`): The starting or failed text.
- `detail` (`string`, default `""`): Why it failed, selectable.
- `textSize` (`"code" | "codeSmall"`, default `"code"`): The font size: 13 or 12.5 px.
- `ligatures` (`boolean`, default `false`): Join ligatures (=>, !=) in fonts that have them.
- `dropTarget` (`boolean`, default `false`): Files are dragged over it: an accent outline.
- `bell` (`number`, default `0`): A bell counter; each new value flashes the screen once.
- `onready` (`(terminal: Terminal) => void`): The xterm Terminal, once it is open.
- `oninput` (`(data: string) => void`): Keys typed, to send to the shell.
- `onresize` (`(size: { cols: number; rows: number }) => void`): The grid size changed.
- `onretry` (`() => void`): Shows Retry in the failed state.
- `children` (`Snippet`): Overlays such as the find bar.

## Rules

- Colors come from the --term-* tokens; never pass an xterm theme.

## Example: A shell

```svelte
<TerminalView label="Terminal" onready={(t) => connect(t)} oninput={send} onresize={resize} />
```

## Replaces in the app

- `src/lib/terminal/TerminalView.svelte frame and states`
