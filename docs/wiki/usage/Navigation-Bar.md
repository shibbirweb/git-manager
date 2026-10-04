# Navigation Bar

The Navigation Bar lets you move around your project from the keyboard, like the **Navigation Bar** in JetBrains IDEs such as PhpStorm. It is the path above the code: every folder in it opens a small list of what that folder holds, and you can type to search that list.

[TODO:navigation-bar.png]

## Open it

- Press **Cmd+Up** on the Mac (**Alt+Home** on Windows and Linux), or choose **Edit > Jump to Navigation Bar**. It works from the editor, the Files panel and, on the Mac, the terminal.
- Or click any part of the path in the [path bar](Editor-and-Tabs.md#the-path-bar).

With the keyboard, the list of the current file's folder opens right away, with the file selected. So **Cmd+Up, Down, Enter** opens the file next to this one.

When no file is on screen (for example on the Log or a diff), the bar shows up floating at the top of the window, starting at the active repository.

In the code editor, Cmd+Up now opens the Navigation Bar, as in JetBrains IDEs. To go to the start of the file, press **Cmd+Home** (Fn+Cmd+Left on a laptop keyboard). In a plain text field, such as the commit message, Cmd+Up still moves the caret.

## Move around

The list shows folders first, then files, with the same icons and git colors as the [Files Panel](Files-Panel.md). A folder has a small arrow at its end. Files that git ignores are dimmed.

| Keys | What they do |
| --- | --- |
| Up and Down (or Ctrl+P and Ctrl+N) | Pick an entry. They wrap around at the ends. |
| Page Up and Page Down | Jump ten entries |
| Right | Go into the selected folder: it becomes the last part of the path and its list opens |
| Left | Go up to the folder above, with the folder you came from selected |
| Enter | Open the selected file, or go into the selected folder |
| Cmd+Enter (Ctrl+Enter) | Open the file in the other editor group, when the [split editor](Editor-and-Tabs.md#tabs) is on |
| Esc | Clear what you typed; press again to close |

A click on an entry does the same as Enter. A click on another part of the path opens that folder's list instead. A click anywhere else closes the bar.

While you move into other folders, the path changes to show where you are. Nothing opens until you choose a file, and closing the bar brings back the path of the file on screen.

## Search

Just start typing while a list is open. The list keeps only the names that contain your letters in order, best match first, and the matching letters are highlighted. They do not need to be next to each other: `crt` finds `cart.ts`.

If nothing in the folder matches, the list offers **Search everywhere for "..."**. Press Enter (or click it) to look for that name in the whole workspace with [Search Everywhere](Search-Everywhere.md).

## Workspaces with several folders

When your [workspace](Workspaces.md) has more than one folder, the path starts with the workspace name. Its list shows every workspace folder, so you can jump from one folder to another.

## Good to know

- The lists are read from disk each time they open, so new files show up right away.
- A folder with more than 5000 entries shows the first 5000, like the Files panel.
- You can change the key in **Settings > Keyboard Shortcuts** (search for "Navigation Bar"). See [Keyboard Shortcuts](Keyboard-Shortcuts.md).

## Related

- [Editor and Tabs](Editor-and-Tabs.md)
- [Recent Files](Recent-Files.md)
- [Search Everywhere](Search-Everywhere.md)
- [Navigation](Navigation.md)
- [How the Navigation Bar works (developer)](../developer/How-the-Navigation-Bar-Works.md)
