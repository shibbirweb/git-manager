# Single Tab Title

In single tab mode (**Tab limit** set to **Single tab**), you work on one file at a time, and a row with one lone tab in it looks a little empty. Git Manager shows that file's name in the middle of the strip instead, like a title above the code. With any other tab limit you always see normal tabs.

[TODO:single-tab-title.png]

*One file open: its name sits in the middle of the strip, above the code.*

## What it looks like

In single tab mode, with **one tab** in the strip:

- The file's icon and name sit in the middle of the strip, without the tab's frame, background or accent line.
- A preview tab (one you opened with a single click) still shows its name in italics, so you can tell it will be replaced by the next file you click.
- A file with unsaved changes still shows a dot to the right of its name.
- A pinned tab still shows its pin. Click the pin to unpin it.
- The close button always shows to the right of the name. With unsaved changes it shows the dot until you move the mouse over it.

Everything else works the same as on a tab:

- Right-click the name for the tab menu: Pin Tab, Close, Split Right, Split Down, Copy Path and the rest.
- Middle-click the name to close the file.
- Double-click the name to keep a preview tab open.

Single tab mode limits file tabs only, so a terminal or a commit can still open next to the file. As soon as the strip holds two tabs, it shows normal tabs again. Close all but one and the title comes back.

## Which tabs count

Every kind of tab counts: files, commits, terminals, compare tabs and the **Diff** tab you get by clicking a changed file in the Changes sidebar. So a diff on its own also shows as a title, and a diff next to an open file shows two tabs.

With the [split editor](Split-Editor.md) on, each group decides for itself. A group with one tab shows a title, while the other groups can still show several tabs.

The title works with [Rounded panels](Rounded-Panels.md) and with [Wrap tabs](Pin-Reorder-and-Wrap-Tabs.md#wrap-tabs) too.

## Turn it on or off

The setting is **on by default**, and it only shows while **Tab limit** is set to **Single tab**.

1. Open **Settings** (Cmd+,) and go to **Editor**.
2. Set **Tab limit** to **Single tab**. The **Single tab title** switch appears below it.
3. Turn **Single tab title** off to show a normal tab even in single tab mode.

The setting is saved as `singleTabTitle` in `settings.json`.

## Related

- [Editor and Tabs](Editor-and-Tabs.md)
- [Pin, Reorder and Wrap Tabs](Pin-Reorder-and-Wrap-Tabs.md)
- [Settings](Settings.md)
- [How the single tab title works (developer)](../developer/How-the-Single-Tab-Title-Works.md)
