# Terminal Bugs We Fixed

The bugs we found in the terminal, why they happened and how we fixed them. How the terminal works is in [How the Terminal Works](How-the-Terminal-Works.md) and [How Terminal Features Work](How-Terminal-Features-Work.md); the user side is in [Terminal](../usage/Terminal.md).

**A black strip under the last row.**
- **The issue:** a thin black band showed at the bottom of the terminal, below the prompt, in every theme.
- **Why it happened:** xterm 6 paints the theme background on its scroll area, which ends at the last whole row. The viewport under it fills the rest of the height, and xterm's own CSS gives it `background-color: #000`. Whatever was left over after the last row showed that black.
- **The fix and why we chose it:** `TerminalView.svelte` gives `.xterm-viewport` the `--term-background` token, the same color xterm uses for the rows, so the strip matches in every theme. We kept xterm's layout and only changed the color, since the leftover space is normal: the panel height is rarely a whole number of rows.

**Rounded panels hid the edge of a terminal.**
- **The issue:** the terminal list and split terminals hid 6px of the terminal beside them.
- **Why it happened:** their handles took the [Rounded Panels](How-Rounded-Panels-Work.md) gap margins, meant for gaps between panels.
- **The fix and why we chose it:** they pass `inPanel`, one switch shared with the Changes tab.

**The window froze while a terminal started.**
- **The issue:** typing in a terminal, or resizing the window, could hang while another terminal was starting.
- **Why it happened:** `TerminalRegistry::spawn` held the registry lock for the whole shell start. `terminal_write` and `terminal_resize` are sync commands on the main thread, and they waited for that lock.
- **The fix and why we chose it:** `spawn` now starts the shell without the lock and takes it only to insert the terminal. A shell that exits before it was added is noted in `exited_early` and removed right after the insert (`shells_that_exit_at_once_never_stay_in_the_registry`). Keeping slow work out of the lock was safer than making the keystroke commands async, which could reorder input.

**The GPU acceleration hint said it costs a few MB.**
- **The issue:** Settings, Terminal said turning GPU acceleration off "saves a few MB of GPU memory per terminal", far too little.
- **Why it happened:** the number was a guess, written before anything was measured.
- **The fix and why we chose it:** three cold starts each way measured about 70 MB for the first terminal, mostly graphics memory, and 10 MB for each other one. Settings and the usage pages now show measured numbers ([Measuring Setting Memory](Measuring-Setting-Memory.md)).

## Related

- [How the Terminal Works](How-the-Terminal-Works.md)
- [How Terminal Features Work](How-Terminal-Features-Work.md)
- [How Rounded Panels Work](How-Rounded-Panels-Work.md)
