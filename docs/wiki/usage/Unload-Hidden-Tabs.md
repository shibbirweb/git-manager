# Unload Hidden Tabs

Every open file tab keeps an editor ready behind it, about 4 MB each. With many tabs open, most of them sit out of sight and still use that memory. **Unload hidden tabs** frees the editor of a tab you have not looked at for a while. The tab stays in the strip, and clicking it opens the file again where you left it.

[TODO:settings-unload-hidden-tabs.png]

*Settings, Editor, Tabs: Unload hidden tabs with its Unload after choices.*

## What happens

- A file tab that has been out of sight for the chosen time (15 minutes by default) is unloaded. Nothing changes in the tab strip.
- When you click it, the file is read again and the editor comes back with the cursor on the same line and the same part of the file in view. If the file changed on disk in the meantime, you see the new text.
- A tab with **unsaved changes** is never unloaded, so you can never lose work this way.
- The tab on screen in each editor group is never unloaded, even while the Log or a diff covers it.
- Only file tabs are unloaded. Commit, compare, history and terminal tabs stay as they are.

What you lose is small, and only for unloaded tabs:

- **Undo history**: Cmd+Z cannot go back past the moment the tab was unloaded. Your saved file is not touched.
- Folded blocks, extra cursors and an open find bar start fresh.

A Markdown file keeps its view (Editor, Editor and preview, or Preview only).

## How much it saves

About 4 MB for each unloaded tab with an ordinary source file, more for long files. With 20 tabs open and 5 of them in use, that is about 60 MB. The [Memory](Memory-Use.md) readout in the status bar shows the difference a few seconds after tabs are unloaded.

## Turn it on or off

It is **on by default**.

1. Open **Settings** (Cmd+,) and go to **Editor**, then **Tabs**.
2. Turn **Unload hidden tabs** off to keep every editor ready, for example if you often undo in files you left a long time ago.
3. While it is on, **Unload after** sets how long a tab stays out of sight first: **5**, **15**, **30** or **60 min**.

The settings are saved as `unloadHiddenTabs` and `unloadHiddenTabsMinutes` in `settings.json`. A **Tab limit** closes old tabs completely instead; the two work together.

## Related

- [Editor and Tabs](Editor-and-Tabs.md)
- [Memory Use](Memory-Use.md)
- [Settings](Settings.md)
- [How unloading hidden tabs works (developer)](../developer/How-Unloading-Hidden-Tabs-Works.md)
