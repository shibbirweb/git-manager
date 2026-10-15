# ElementHost

A box whose element the app fills itself, such as a terminal that moves between places.

```ts
import ElementHost from "@git-manager/ui/components/ElementHost.svelte";
```

Group: Layout. Also known as: Mount point, Slot, Portal target.

## When to use

Use only for content the app builds or moves outside Svelte's markup (xterm.js, a parked terminal). The app gets the
element in `onready`; everything else on a screen is library components.

## Props

- `label` (`string`): Accessible name; makes it a group for screen readers.
- `fill` (`"none" | "grow" | "cover"`, default `"none"`): Its size: its content's, grow in a flex parent, or cover a
  positioned parent.
- `surface` (`"none" | "editor"`, default `"none"`): Paint the editor background behind it.
- `hidden` (`boolean`, default `false`): Out of sight and out of the layout, such as a parked terminal.
- `clip` (`boolean`, default `false`): Hide what overflows its box.
- `stretch` (`boolean`, default `false`): What the app mounts fills the box, such as a CodeMirror editor.
- `onready` (`(element: HTMLDivElement) => void | (() => void)`): The element, once in the page; may return a cleanup
  that runs when it goes.
- `children` (`Snippet`): Content inside, before anything the app moves in.

## Rules

- Never use it to draw UI: screens are built from components, not from elements the app makes.

## Example: A terminal tab's slot

```svelte
<ElementHost fill="grow" surface="editor" clip onready={(element) => attach(element)} />
```

## Replaces in the app

- `<div class="terminal-slot" bind:this={slot}> in TerminalSlot.svelte`
- `<div class="terminal-host"> and the parking frame in TerminalHost.svelte and TerminalFrame.svelte`
