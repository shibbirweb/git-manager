# Search in Settings

Settings has many sections and many rows. Instead of clicking through them, type what you are looking for in the search field at the top left of the Settings dialog. The list of sections shrinks to the ones that have a match, and the open section shows only the matching settings, with the matching words highlighted.

[TODO:settings-search.png]

*Searching for "font": only the sections with a font setting stay in the list, and the Editor section shows only its font settings.*

## Search for a setting

1. Open **Settings** (Cmd+,). The search field is ready for typing right away.
2. Type a word, for example `font`, `blame` or `wrap`.
3. The section list keeps only the sections with a match. If the section on screen has no match, the first section that does opens.
4. The open section hides every setting that does not match, so only the matches are left, with the matching words highlighted.
5. Click another section in the list to see its matches.

To show every section again, clear the field with the small **x** at its right end, or press Esc. Press Esc a second time to close Settings.

A few things stay with a match so it still makes sense:

- A group heading (such as **Saving** or **Font**) shows while any setting under it matches. If the heading itself matches, its whole group shows.
- The settings that belong to a matching setting stay with it, such as **Margin column** under **Right margin line**.

When nothing matches, the list says **Nothing found** and the page says which search found nothing.

## How words are matched

- Case does not matter: `Font` and `font` are the same.
- Each word you type must be the start of a word in the setting. `ligat` finds **Font ligatures**, but `atures` does not.
- With several words, a setting must match all of them. `cursor blink` finds **Cursor blinking** and the terminal's **Cursor blink**.
- A section's name counts too. `terminal font` finds only the font rows of the **Terminal** section, and typing a section name like `updates` keeps that section in the list.
- Punctuation splits words, so `Cmd+E` searches for `cmd` and `e`.

Many settings can also be found by other words people often use. For example `ruler` finds **Right margin line**, `autosave` finds **Auto save**, `nerd font` finds **Icons from patched fonts**, and `mcp` finds the rows of **Automation**. When a setting is found this way, its whole name is highlighted.

Some rows only appear when another setting is on, such as **Margin column** under **Right margin line**. When such a row matches while it is hidden, the row it belongs to shows and is highlighted instead, so you know where to turn it on.

## Keyboard shortcuts

The search also looks at every command in **Keyboard Shortcuts**. If a command matches, for example `push` or `commit`, the **Keyboard Shortcuts** section stays in the list, and opening it shows those commands already filtered by your search. You can still change the filter there.

## Related

- [Settings](Settings.md)
- [Terminal, GitHub and Automation Settings](Settings-Terminal-and-Automation.md)
- [Keyboard Shortcuts](Keyboard-Shortcuts.md)
- [How search in Settings works (developer)](../developer/How-Settings-Search-Works.md)
