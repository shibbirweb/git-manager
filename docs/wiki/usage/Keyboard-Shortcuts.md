# Keyboard Shortcuts

Every shortcut in Git Manager, grouped by where it works. Keys are written as on a Mac keyboard: Cmd (Command), Shift, Option and Ctrl (Control).

Window-wide shortcuts that use Cmd also accept Ctrl, for future Windows and Linux builds.

## Anywhere in the window

| Keys | Action |
| --- | --- |
| Cmd+, | Open Settings |
| Cmd+B | Hide the left sidebar, or show Changes when it is hidden |
| Shift+Cmd+G | Show Changes |
| Shift+Cmd+E | Show Branches and Stashes |
| Shift+Cmd+L | Show or hide the Log |
| Option+Cmd+B | Show or hide the Files panel |
| Ctrl+- | Go Back |
| Ctrl+Shift+- | Go Forward |
| Esc | Close the open dialog, menu or popup |

Ctrl+- really is Control, not Command, as in VS Code on the Mac. These keys wait while a dialog or the merge tool is open. In the editor, a key the editor uses itself (such as Ctrl+B) does the editor action instead. See [Navigation](Navigation.md).

## Mouse shortcuts

| Action | Result |
| --- | --- |
| Mouse back and forward buttons | Go Back and Go Forward |
| Option-click **Push** | Force push (with `--force-with-lease`), after a confirmation |
| Ctrl or Cmd + scroll, or pinch, over code | Change the editor font size (turn it on in Settings, Editor) |
| Click a blame note or gutter block | Open that commit in the Log |
| Option-click a blame note or gutter block | Copy the commit hash |
| Double-click a file in Changes | Stage or unstage it (a conflicted file opens in the merge tool) |
| Double-click a commit in the Log | Open it in a tab |
| Double-click a changed file of a commit | Open the commit in a tab on that file |
| Double-click a branch or tag | Check it out |
| Double-click a file in the Files panel | Open it in a tab that stays open |
| Double-click a tab | Keep a preview tab open |
| Middle-click a tab | Close the tab |
| Double-click a sidebar edge | Reset the sidebar width |
| Double-click the Settings title | Center the Settings dialog |

## Editor

These work in the file editor. Search, selection and cursor keys also work in the read-only panes of diffs and the merge tool.

| Keys | Action |
| --- | --- |
| Cmd+S | Save the file |
| F7 and Shift+F7 | Next and previous change or conflict |
| Cmd+Z and Shift+Cmd+Z | Undo and redo |
| Cmd+U and Shift+Cmd+U | Undo and redo the last cursor move |
| Tab and Shift+Tab | Indent and outdent |
| Cmd+] and Cmd+[ | Indent and outdent the line |
| Cmd+Option+\ | Fix the indentation of the selection |
| Cmd+/ | Comment or uncomment the line |
| Ctrl+Shift+A | Block comment |
| Option+Up and Option+Down | Move the line up or down |
| Shift+Option+Up and Shift+Option+Down | Copy the line up or down |
| Shift+Cmd+K | Delete the line |
| Cmd+Enter | Insert a blank line below (in the merge tool it applies) |
| Cmd+Option+Up and Cmd+Option+Down | Add a cursor above or below |
| Cmd+A | Select all |
| Ctrl+L | Select the line |
| Cmd+I | Grow the selection to the enclosing code block |
| Shift+Cmd+\ | Jump to the matching bracket |
| Esc | Go back to a single cursor |
| Shift+Option+M | Let Tab move the focus instead of indenting (again to undo) |

Moving and deleting:

| Keys | Action |
| --- | --- |
| Option+Left and Option+Right | Move by word |
| Ctrl+Left and Ctrl+Right | Move by code element |
| Cmd+Left and Cmd+Right | Start and end of the line |
| Cmd+Up and Cmd+Down | Start and end of the file |
| Ctrl+Up and Ctrl+Down, Page Up and Page Down | Move a page |
| Option+Backspace and Option+Delete | Delete a word |
| Cmd+Backspace and Cmd+Delete | Delete to the start or end of the line |

Add Shift to the moving keys to select. The macOS text keys work too: Ctrl+A and Ctrl+E (line start and end), Ctrl+K (delete to line end), Ctrl+D and Ctrl+H (delete a character), Ctrl+T (swap characters), Ctrl+O (split the line), Ctrl+F, Ctrl+B, Ctrl+N and Ctrl+P (move) and Ctrl+V (page down).

Search:

| Keys | Action |
| --- | --- |
| Cmd+F | Find (Esc closes the search bar) |
| Cmd+G or F3 | Find next |
| Shift+Cmd+G or Shift+F3 | Find previous |
| Option+Cmd+G | Go to line |
| Cmd+D | Select the next match of the selection |
| Shift+Cmd+L | Select every match of the selection |

Two of these share keys with window shortcuts. Inside an editor the editor's action wins, as in other Mac apps: Shift+Cmd+G finds the previous match, and Shift+Cmd+L with text selected selects every match. Outside an editor they show Changes and the Log. See [Editor and Tabs](Editor-and-Tabs.md).

## Changes and commits

Click in the Changes list first.

| Keys | Action |
| --- | --- |
| Up and Down | Select the previous or next file (its diff opens) |
| Space or Enter | Stage the file, or unstage it when it is staged |
| Delete or Backspace | Discard the changes of an unstaged file (asks first) |
| Cmd+Enter (in the message box) | Commit |

See [Changes and Commits](Changes-and-Commits.md).

## Diffs

| Keys | Action |
| --- | --- |
| F7 and Shift+F7 | Next and previous change |

See [Diffs](Diffs.md).

## Conflicts dialog

| Keys | Action |
| --- | --- |
| Up and Down | Select the previous or next file |
| Enter | Open the selected file in the merge tool |
| Cmd-click, Shift-click | Select several files |
| Esc | Close the dialog |

See [Resolving Conflicts](Resolving-Conflicts.md).

## Merge tool

| Keys | Action |
| --- | --- |
| F7 and Shift+F7 | Next and previous unresolved change |
| Cmd+Z and Shift+Cmd+Z | Undo and redo in the result (also restores the change buttons) |
| Cmd+Enter | Apply: save the result and mark the file resolved |
| Esc | Cancel, like the close button (not while the search bar has focus) |

Cmd+Enter applies from any pane, including the result, so in the merge tool it does not insert a blank line. The same keys work when git starts the tool (see [Git Mergetool](Git-Mergetool.md)).

## Files panel

Click in the tree first.

| Keys | Action |
| --- | --- |
| Up and Down | Move the selection |
| Right | Open the folder |
| Left | Close the folder, or go to its parent |
| Enter | Open the file, or open or close the folder |

## Branches sidebar

Click in the list first.

| Keys | Action |
| --- | --- |
| Up, Down, Home, End | Move the selection |
| Right and Left | Open and close sections and folders; Left on a branch goes to its folder |
| Enter | Check out the selected branch or tag, or fold a section |
| Space | Fold or unfold the selected section or folder |
| Delete or Backspace | Delete the selected local branch (asks first) |
| Shift+F10 or the menu key | Open the right-click menu |
| Esc (in the filter box) | Clear the filter |
| Down or Enter (in the filter box) | Jump to the first match |

## Log

| Keys | Action |
| --- | --- |
| Up and Down | Select the previous or next commit |
| Enter | Open the selected commit in a tab |
| Page Up and Page Down | Move a page at a time |
| Home and End | First or last loaded commit |
| Esc (in the filter box) | Clear the filter |
| Down or Enter (in the filter box) | Jump into the list |
| Up and Down (in the changed files) | Select another file of the commit |

## Dialogs and panels

| Keys | Action |
| --- | --- |
| Enter | Confirm the dialog (for example Create or Stash) |
| Esc | Cancel the dialog, or close Settings, the update window or What's New |
| Left and Right on a focused sidebar edge | Resize the sidebar by 10 pixels (40 with Shift) |

## Related

- [Navigation](Navigation.md)
- [Editor and Tabs](Editor-and-Tabs.md)
- [Merge Tool](Merge-Tool.md)
- [Getting Started](Getting-Started.md)
- [Frontend (developer)](../developer/Frontend.md)
