# Editor and List Shortcuts

The keys of the text editor, the find bar, Markdown files, diffs, the merge tool, and the lists and dialogs of the app. Keys are written as on a Mac keyboard. The window and menu shortcuts are on [Keyboard Shortcuts](Keyboard-Shortcuts.md).

## Editor

These work in the file editor. Search, selection and cursor keys also work in the read-only panes of diffs and the merge tool: the panes you can read and select in but not type in.

| Keys | Action |
| --- | --- |
| Cmd+S | Save the file |
| F7 and Shift+F7 | Next and previous change or conflict |
| Cmd+Z and Shift+Cmd+Z | Undo and redo |
| Cmd+U | Undo the last cursor move |
| Tab and Shift+Tab | Indent and outdent |
| Option+Cmd+\ | Fix the indentation of the selection |
| Option+Shift+Up and Option+Shift+Down | Copy the line up or down |
| Cmd+Enter | Insert a blank line below (in the merge tool it applies) |
| Option+Cmd+Up and Option+Cmd+Down | Add a cursor above or below |
| Cmd+A | Select all |
| Ctrl+L | Select the line |
| Cmd+I | Grow the selection to the enclosing code block |
| Shift+Cmd+\ | Jump to the matching bracket |
| Esc | Go back to a single cursor |
| Option+Shift+M | Let Tab move the focus instead of indenting (again to undo) |

## Code menu

The Code menu's items run in the focused editor, with these keys. What each item does is on [Editing Code](Editing-Code.md#the-code-menu).

| Keys | Action |
| --- | --- |
| Cmd+/ | Comment with Line Comment |
| Option+Cmd+/ (or Ctrl+Shift+A) | Comment with Block Comment |
| Shift+Cmd+D | Duplicate Line or Selection |
| Shift+Cmd+K | Delete Line |
| Ctrl+Shift+J | Join Lines |
| Option+Up and Option+Down | Move Line Up and Move Line Down |
| Cmd+] and Cmd+[ | Indent Line and Unindent Line |
| Shift+Cmd+U | Toggle Case |
| Option+Cmd+] and Option+Cmd+[ | Folding > Expand and Collapse |
| Ctrl+Option+] and Ctrl+Option+[ | Folding > Expand All and Collapse All |
| Cmd+L | Go to Line... (type `line` or `line:column`) |
| Option+Cmd+G | CodeMirror's own small line field |
| Cmd+D | Select Next Occurrence |

Sort Lines has no key.

## Moving and deleting

| Keys | Action |
| --- | --- |
| Option+Left and Option+Right | Move by word |
| Ctrl+Left and Ctrl+Right | Move by code element |
| Cmd+Left and Cmd+Right | Start and end of the line |
| Cmd+Up and Cmd+Down | Start and end of the file |
| Ctrl+Up and Ctrl+Down, Page Up and Page Down | Move a page |
| Option+Backspace and Option+Delete | Delete a word |
| Cmd+Backspace and Cmd+Delete | Delete to the start or end of the line |

Add Shift to the moving keys to select. The macOS text keys work too, such as Ctrl+A and Ctrl+E (line start and end), Ctrl+K (delete to line end) and Ctrl+T (swap characters).

## Find bar

| Keys | Action |
| --- | --- |
| Cmd+F | Find (Cmd+R opens it with Replace) |
| Enter and Shift+Enter | Next and previous match |
| Cmd+G or F3, Shift+Cmd+G or Shift+F3 | Next and previous match, also from the text |
| Option+Enter (in Find) | Select all matches |
| Ctrl+Cmd+G | Select All Occurrences |
| Shift+Cmd+L | Select every match of the selection |
| Option+C, Option+W, Option+X | Match Case, Words, Regex |
| Tab | Move between Find and Replace |
| Enter (in Replace) | Replace |
| Shift+Cmd+Enter (in Replace) | Replace All |
| Esc | Close the find bar |

See [Find and Replace](Find-and-Replace.md).

## Markdown

| Keys | Action |
| --- | --- |
| Cmd+I | Italic, in the source editor and in Preview Only |
| Cmd+K | Link, in the source editor and in Preview Only |
| Cmd+B | Bold, in the source editor and in Preview Only |
| Cmd+S | Save, also from either preview |
| Cmd-click a link | Open it, in Preview Only (in the split preview a plain click opens it) |

While you type in a Markdown file, Cmd+B makes text bold instead of hiding the sidebar. Click outside the text, for example on the file tree, and Cmd+B hides the sidebar again. See [Markdown Editor](Markdown-Editor.md).

## Diffs and the merge tool

| Keys | Action |
| --- | --- |
| F7 and Shift+F7 | Next and previous change (in the merge tool: unresolved change) |
| Left and Right on the line between diff sides | Move it (Shift for bigger steps) |
| Cmd+Z and Shift+Cmd+Z | Undo and redo in the merge result (also restores the change buttons) |
| Cmd+Enter | Merge tool: Apply, save the result and mark the file resolved |
| Esc | Merge tool: Cancel, like the close button (not while the search bar has focus) |

Cmd+Enter applies from any pane of the merge tool, so there it does not insert a blank line. The same keys work when git starts the tool (see [Git Mergetool](Git-Mergetool.md)).

## Lists

Click in the list first.

| Where | Keys |
| --- | --- |
| Changes | Up and Down select a file (its diff opens); Space or Enter stages or unstages it; Delete or Backspace discards an unstaged file (asks first) |
| Commit message | Cmd+Enter commits |
| Files panel | Up and Down move; Right opens a folder; Left closes it or goes to its parent; Enter opens the file or toggles the folder |
| Branches sidebar | Up, Down, Home, End move; Right and Left open and close sections and folders; Space folds |
| Branches sidebar, on a branch | Enter checks out the branch or tag; Delete removes a local branch (asks first) |
| Log | Up and Down select a commit; Enter opens it in a tab; Page Up, Page Down, Home and End jump; Up and Down in the changed files select another file |
| Scripts | Up, Down, Home, End move; Right and Left open and close a file; Enter runs the script |
| File history and line history tabs | Up and Down select a commit; Enter opens it |
| Shelf | Enter shows the diff of a shelved file; Cmd-click selects several |
| Conflicts dialog | Up and Down select a file; Enter opens it in the merge tool; Cmd-click and Shift-click select several |
| Color theme picker | Up, Down, Home, End, Page Up and Page Down move through the themes |

In the Branches sidebar and Scripts, Shift+F10 or the menu key opens the right-click menu. In their filter boxes, Esc clears the filter and Down or Enter jumps to the first match.

## Popups and dialogs

| Where | Keys |
| --- | --- |
| Search Everywhere | Up and Down (or Ctrl+N and Ctrl+P), Page Up and Page Down move; Tab and Shift+Tab switch tabs; Esc closes |
| Search Everywhere, open and options | Enter opens in a tab that stays; Shift+Enter or Cmd+Enter opens a preview tab; Option+C, W, X toggle the Text options |
| Branches popup ([Branches Popup](Branches-Popup.md)) | Up and Down move; Enter, or Right with an empty filter, opens the branch's actions |
| Interactive Rebase | Up and Down move; Option+Up and Option+Down move the commit; P, R, E, S, F, D pick Pick, Reword, Edit, Squash, Fixup, Drop |
| Git dialogs (Push, Pull, Merge...) | Cmd+Enter runs the dialog; Esc closes it |
| Right-click menus | Up, Down, Home, End move; Right opens a submenu and Left closes it; Enter or Space picks; Esc closes |
| Other dialogs | Enter confirms (Cmd+Enter from a box with several lines); Esc cancels |
| Sidebar and panel edges | Arrow keys resize by 10 pixels (40 with Shift) |

## Related

- [Keyboard Shortcuts](Keyboard-Shortcuts.md)
- [Editor and Tabs](Editor-and-Tabs.md)
- [Merge Tool](Merge-Tool.md)
- [Search Everywhere](Search-Everywhere.md)
