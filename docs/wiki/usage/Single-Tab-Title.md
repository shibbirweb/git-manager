# Single Tab Title

When only one file is open, a row with one lone tab in it looks a little empty. Git Manager shows that file's name in the middle of the strip instead, like a title above the code. Open a second file and the normal tabs come back.

[TODO:single-tab-title.png]

*One file open: its name sits in the middle of the strip, above the code.*

## What it looks like

With **one tab** in the strip:

- The file's icon and name sit in the middle of the strip, without the tab's frame, background or accent line.
- A preview tab (one you opened with a single click) still shows its name in italics, so you can tell it will be replaced by the next file you click.
- A file with unsaved changes still shows a dot to the right of its name.
- A pinned tab still shows its pin. Click the pin to unpin it.
- The close button always shows to the right of the name. With unsaved changes it shows the dot until you move the mouse over it.

Everything else works the same as on a tab:

- Right-click the name for the tab menu: Pin Tab, Close, Split Right, Copy Path and the rest.
- Middle-click the name to close the file.
- Double-click the name to keep a preview tab open.

As soon as the strip holds two tabs, it shows normal tabs again. Close all but one and the title comes back.

## Which tabs count

Every kind of tab counts: files, commits, terminals, compare tabs and the **Diff** tab you get by clicking a changed file in the Changes sidebar. So a diff on its own also shows as a title, and a diff next to an open file shows two tabs.

With the [split editor](Editor-and-Tabs.md#tabs) on, each group decides for itself. A group with one tab shows a title, while the other group can still show several tabs.

The title works with [Rounded panels](Rounded-Panels.md) and with [Wrap tabs](Pin-Reorder-and-Wrap-Tabs.md#wrap-tabs) too.

## Turn it on or off

The setting is **on by default**.

1. Open **Settings** (Cmd+,) and go to **Editor**.
2. Turn **Single tab title** off to always show tabs, even when only one file is open.

The setting is saved as `singleTabTitle` in `settings.json`.

## Related

- [Editor and Tabs](Editor-and-Tabs.md)
- [Pin, Reorder and Wrap Tabs](Pin-Reorder-and-Wrap-Tabs.md)
- [Settings](Settings.md)
- [How the single tab title works (developer)](../developer/How-the-Single-Tab-Title-Works.md)
