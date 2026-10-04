# Clear Cache

Git Manager draws its window with WebKit, the engine behind Safari. When you close files, the app lets go of everything they used, but WebKit often keeps that memory for itself instead of giving it back to macOS. After a busy session, for example many Markdown files with diagrams, the **Memory** readout can stay hundreds of MB above where it started even with every tab closed.

**Clear Cache** gives all of it back. It restarts the window's interface in a fresh WebKit process, so the window starts again as light as when you opened the project.

[TODO:status-bar-clear-cache.png]

*The Clear Cache button beside the Memory readout in the status bar.*

## Use it

- Click the **Clear Cache** button (a brush) right of **Memory** in the status bar, or
- choose **View > Clear Cache**, which also works from the Command Palette.

The screen blinks once. Your folder, the open tabs (when **Reopen tabs on start** is on), the sidebar and the panels come back as they were. A tab you were looking at loads again like a file you just opened.

**Terminals keep running.** Each terminal and Run session comes back in the same place (the panel, a split, an editor tab or the Run tab) with what it showed before, and anything it printed during the blink appears right after. A command that was running, such as a dev server or a build, never stops.

## When it waits or asks

Clear Cache never throws away your work:

- **Unsaved changes**: it does nothing and says so. Save or close those files first.
- **A git operation running** (a fetch, a pull, a commit): it waits until that finishes.
- **The merge tool is open**: finish or close it first.

## How much it gives back

In a test on a MacBook Pro, the project opened at 124 MB. Four Markdown files with four diagrams each took it to 435 MB, and closing them left 328 MB. Clear Cache brought it back to 127 MB.

What a file costs when you open it again is the same as the first time: the memory comes back only for what is on screen.

## Good to know

- Clear Cache restarts only the window you use it in. Other windows keep running.
- A terminal's text comes back as it looked, colors included. Its find highlights and a selection do not.
- It is available on macOS. On other systems the button is not shown.
- You do not need it often. The app already frees what you close (see [Memory Use](Memory-Use.md)); Clear Cache is for the memory WebKit keeps anyway.

## Related

- [Memory Use](Memory-Use.md)
- [Unload Hidden Tabs](Unload-Hidden-Tabs.md)
- [Status Bar and Help](Status-Bar-and-Help.md)
- [How Clear Cache works (developer)](../developer/How-Clear-Cache-Works.md)
