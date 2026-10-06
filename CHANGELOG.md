# Changelog

All notable changes to Git Manager are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/).

Write every user-visible change under **Unreleased** as it lands. The "Beta release"
workflow publishes those notes as they are with each beta; the "Stable release"
workflow dates them into a `## [x.y.z] - YYYY-MM-DD` section. The section becomes the
GitHub release notes, and the app shows it as "What's New".

## [Unreleased]

### Added

- Git Manager for Windows 10 and 11: a per-user installer (the `-setup.exe` of a release, no administrator rights needed) with the same features as on macOS. Paths show as `C:/...`, shortcuts use Ctrl, the terminal starts PowerShell, Command Prompt or Git Bash, deleted files go to the Recycle Bin, the GitHub token is kept in Windows Credential Manager, a second launch opens its folder in the running app, Cancel stops git and everything it started, and the status bar counts memory like Task Manager. The installer is not signed yet, so Windows SmartScreen asks once (More info, Run anyway).
- `git-manager cli call` reads its arguments from a JSON file with `--args-file <file>`, or from stdin with `--args-file -`, for shells that mangle quotes such as Windows PowerShell 5.1.
- Clone Repository... on the welcome screen opens the Clone dialog, so you can start from a repository on GitHub or another server without opening a folder first. Scripts and AI tools can clone too: `git-manager cli clone <url> [folder] [--into <folder>] [--open window|workspace]` and the MCP tool `clone_repository`. The tool starts off, since it writes outside the open folders; turn it on in Help > Available MCP Tools.
- The Changes tab (click **N changes** in the status bar) can stage, unstage and discard: hover a file for Stage, Unstage and Discard changes, right-click it for more, or use Stage all, Unstage all and Discard all next to **Changed files**. A **staged** or **partly staged** tag shows what is in the next commit.
- The Changes tab has a commit box below its file list, the same one as the Changes sidebar with the same message, so you can commit (or commit and push) without leaving the tab.
- New File, like Sublime Text: File > New File (Cmd+N) opens an empty Untitled tab named after its first line. Cmd+S asks where to save it; saved inside the folder, the tab becomes that file's tab.
- Remember unsaved changes in Settings > Editor > Saving (on by default): closing the window, quitting, Close Folder and Clear Cache keep the text of Untitled tabs and the unsaved edits of files, without asking, and the tabs come back with them the next time the folder opens. The text is kept in `~/.gitmanager/unsaved` until you save, revert or discard it. Closing a tab yourself still asks.

- Clear Cache: a brush button right of Memory in the status bar, and View > Clear Cache, restart the window's interface in a fresh WebKit process and give back all the memory it holds (measured: 328 MB with every file closed after a Markdown session, 127 MB after). The screen blinks once and the folder and tabs come back. Terminals and Run sessions keep running and come back in the same place with what they showed, so a dev server or a build never stops. It waits for unsaved files and running git operations.
- Unload hidden tabs in Settings > Editor (on by default): a file tab you have not looked at for 15 minutes (or 5, 30, 60) frees its editor, about 4 MB each. The tab stays in the strip and opens again at the same line; tabs with unsaved changes are never unloaded. Undo history of an unloaded tab starts over.
- Syntax highlighting switch in Settings > Editor (on by default). Off, code in editors, diffs, the merge tool and Markdown code blocks shows as plain text and no language grammar is loaded, which saves about 35 MB. Toggle Comment still works; fold arrows and bracket pair colors need highlighting, and sticky scroll follows the indentation instead.
- Search in Settings: type in the field at the top left of the Settings dialog to keep only the sections with a match, and the open section shows only the matching settings with the matched words highlighted. Words match the start of a setting's words, other common names work too (for example "ruler" or "autosave"), and matching keyboard shortcuts filter the Keyboard Shortcuts list. Esc clears the search, then closes Settings.
- Single tab title in Settings > Editor (on by default): with Tab limit set to Single tab and only one tab open, the tab strip shows the file's name in the middle instead of a lone tab. Open a second tab, such as a terminal, and the tabs come back.
- Navigation Bar, like JetBrains: press Cmd+Up (Alt+Home on Windows and Linux), choose Edit > Jump to Navigation Bar, or click the path above the code to open a list of what each folder holds. Up and Down pick, Right and Left go into and out of folders, Enter opens a file, and typing searches the list, with Search Everywhere one Enter away when nothing matches. The welcome screen of an open project shows the bar at the top, and on the Log or a diff it floats at the top of the window. In the code editor Cmd+Up now opens it (Cmd+Home still goes to the start of the file). Settings > Appearance > File toolbar puts each file's toolbar (path, badges and buttons) at the Top or the Bottom of the code, or hides it, with a switch for each part: path, badges, change arrows, Blame, Copy relative path, the Markdown view switch and the Markdown formatting row. Without the path, Cmd+Up shows the bar floating at the top left of the editor.
- Recent Files, like JetBrains: Cmd+E (Ctrl+E on Windows and Linux) or Edit > Recent Files lists the files you worked on last, with the previous file selected so Cmd+E, Enter switches back. Type to filter, press Cmd+E again for edited files only, and Delete to take a file off the list. Each workspace keeps its own list across restarts, and Quick Open and Search Everywhere show the same recent files. It is on by default and can be turned off in Settings > Editor > Recent Files (measured at about 1 MB); while it is off, Cmd+E says so and offers to open the setting.
- Editor font weight in Settings > Editor: draw code from Thin (100) to Black (900), with a live preview. Light (300) with JetBrains Mono gives a soft look like JetBrains IDEs. It applies to the editor, diffs, the merge tool and Markdown code blocks.
- The empty editor area also offers Go to File (Cmd+P) and Search Everywhere (Shift Shift).
- JetBrains-style 3-way merge tool: Yours, Result and Theirs panes with connectors, apply, append and ignore per change, apply all non-conflicting changes, word-level highlights, synchronized scrolling, F7 navigation, full undo and ignore-whitespace mode.
- Conflicts dialog to accept yours or theirs for whole files (including binary and deleted files), then continue or abort the merge, rebase, cherry-pick or revert.
- Inline conflict actions in the editor: Accept Current, Accept Incoming, Accept Both and Resolve in Merge Tool, plus Mark as Resolved.
- Workspaces like VS Code: open any folder (git or not), nested repositories, several folders in one workspace, and workspace files compatible with `.code-workspace`.
- Changes sidebar grouped by repository with staging of files and hunks, discard, commit and amend.
- Stage, unstage or discard selected lines in the Changes diff, like GitHub Desktop: select lines on either side and use the toolbar, the right-click menu, Git > Uncommitted Changes or Option+Shift+Cmd+S / U / D. Discard asks first and offers Undo.
- Editor tabs with preview tabs, git status letters in the Files panel, breadcrumbs, change markers on the scrollbar and next or previous change navigation.
- Git blame for the current line and a blame gutter, with click-through to the commit in the Log.
- Log with a branch graph, commit details and per-file diffs; cherry-pick, revert, reset and checkout.
- Open a commit in its own editor tab, like VS Code, so its diff gets the whole editor area: double-click it in the Log, press Enter, use Open in Tab, or double-click one of its files.
- Branches, tags and stashes sidebar; fetch, pull and push with progress.
- Back and Forward navigation across files, diffs and commits.
- Settings saved in `~/.gitmanager`: theme, fonts, ligatures, tab size, word wrap, blame, zoom with Ctrl or Cmd + mouse wheel.
- Status bar with the current repository, branch, cursor position and the app's memory use.
- Clicking the changes count in the status bar opens a Changes tab: every uncommitted file of the repository, each compared with the last commit. Its file list can be resized or hidden to give the diff more room.
- Works as `git mergetool`.
- Update check: notify-only checks for new releases on the stable or beta channel, with release notes and a download link, plus What's New after an update.
- Settings, About: star the project on GitHub, report a bug (with your version filled in) or request a feature.
- A wiki with a user guide (with screenshots of every feature) and developer docs, published from `docs/wiki`.
- Native menu bar with Git Manager, File, Edit, View, Code, Git, Window and Help menus that show each item's shortcut, and Help > Keyboard Shortcuts opens an in-app window listing every shortcut, with a filter.
- JetBrains-style Git menu: Commit, Push and Pull dialogs, Update Project, Fetch, Merge and Rebase dialogs with their options, Branches, New Branch, New Tag, Reset HEAD (soft, mixed, hard or keep), Continue, Abort and Skip for an operation in progress, Manage Remotes, Clone with Cancel, Cherry-Pick and Force Push.
- Interactive Rebase dialog: reorder, reword, squash, fixup, edit and drop commits, including ranges with merge commits.
- Create, delete and push tags, Drop All Stashes, and Interactively Rebase from Here in the Log.
- Git > Current File: commit or add the file, blame, Show Diff, Compare with Revision or Branch, Show History, Show History for Selection and Rollback, with history and compare views in their own tabs.
- Patches: create a patch from changes or a commit, and apply one from a file or the clipboard.
- Branches popup actions: update or push a branch that is not checked out, set or unset its upstream, compare it with the current branch or the working tree.
- Per-repository actions in the Changes sidebar, like VS Code: a branch picker with change marks, Sync Changes (pull, then push) or Publish Branch, Commit, Refresh and a ... menu with Commit, Changes, Pull and Push, Branch, Stash and Tags submenus and Show Log.
- Commit button menu with Commit & Push, Commit & Sync and Commit (Amend), Undo Last Commit in the ... menu, and commit options: sign off, another author, GPG signing and skipping hooks.
- Add to .gitignore (or `.git/info/exclude`) from the Files panel and the Changes list, and Edit .gitignore.
- Shelf, like JetBrains: put changes aside as patches kept in the repository's git folder, then unshelve all or some files later.
- Git Console in the bottom panel: every git command the app runs, with its output and exit code. Off by default (Settings > Git > Git Console).
- Worktrees: create, open, lock, unlock, remove and prune linked work folders of a repository.
- Submodules: init, update (also to the latest remote), sync URLs, add, remove and open a submodule as a repository.
- Git LFS: track and untrack patterns, pull, fetch and prune LFS objects, and install the hooks.
- GitHub account (Settings > GitHub) with a token kept only in the system keychain, or the GitHub CLI: Share Project on GitHub, Sync Fork, Create Gist, and links to open the repository, create a pull request or copy a GitHub link.
- Integrated terminal in the bottom panel: several terminals, a shell picker, Ctrl+` to show or hide it and Ctrl+Shift+` for a new one, terminals moved into the editor area and back, and Settings > Terminal for fonts, cursor, scrollback and copy on selection.
- Files panel: Open in Integrated Terminal and Reveal in Finder.
- Clicking the branch in the status bar opens the Branches popup to check out another branch, like JetBrains, instead of the Branches sidebar.
- The memory popup in the status bar has a GPU acceleration section: whether the terminals use the GPU (or why not), and whether the web view supports WebGL; the window itself always draws with the GPU.
- Image and PDF preview: images (PNG, JPEG, GIF, WebP, BMP, ICO, AVIF) open fitted with zoom, and PDFs open in the built-in viewer; a preview frees its memory when its tab is hidden or closed.
- Binary images and PDFs in every diff show their old and new version side by side, with one zoom for both images, and big PDFs load in pieces instead of all at once.
- Open File button in the diff toolbar, after Blame: opens the real file in an editor tab, at the same line when the right side is the working tree.
- View > Word Wrap (Option+Z) turns word wrap on or off in every open file at once, like VS Code.
- Editor cursor settings like VS Code (style: line, line thin, block, block outline, underline, underline thin; width; blinking: blink, smooth, phase, expand, solid; smooth caret animation) and Sublime Text's caret extra top and bottom, in Settings > Editor.
- Files panel: Select Opened File (the crosshair button) opens the folders down to the file you are editing, selects it and scrolls to it, like JetBrains.
- Scripts tool window: run npm, yarn, pnpm, bun, Composer, Make, Deno and just scripts from the left activity bar, in a Run tab with Rerun and Stop, with the Node version each package asks for.
- Search Everywhere (double Shift) with All, Classes, Files, Symbols and Text tabs, Go to File (Shift+Cmd+O), Go to Class (Cmd+O), Go to Symbol (Option+Cmd+O) and Find in Files (Shift+Cmd+F). Text selected in the editor fills the search field.
- Find and replace bar in the editor (Cmd+F, Cmd+R) with Match Case, Words and Regex, a match counter and Select All Occurrences, plus Replace in Files (Shift+Cmd+R), which skips files with unsaved edits.
- Code menu commands: comments, duplicate, delete, join, move, indent, toggle case and sort lines, folding, Go to Line, and Select Next Occurrence (Cmd+D) for multiple cursors.
- Markdown editor: formatting toolbar, live preview with linked scrolling, mermaid diagrams and local images, as Editor Only, Editor and Preview, or Preview Only.
- Preview Only edits the rendered Markdown page in place and keeps untouched text exactly as it was.
- 41 color themes, with one pick for light mode and one for dark mode, in Settings > Editor, including JetBrains Islands Light and Islands Dark and VS Code Light+ and Dark+.
- Rounded panels in Settings > Appearance, like JetBrains Islands: the sidebars, editors and the bottom panel become rounded panels with space between them, with pill-shaped editor tabs. Works with every color theme and is off by default. The window color always stands apart from the editor too, so in Git Manager Dark the editor shows as its own rounded panel, like in the light theme.
- Settings > Editor: Line spacing and Render whitespace, applied to the editor, diffs and the merge tool.
- Resizable side-by-side diffs: drag the line between the two sides, or double-click it for 50/50.
- Header buttons to show or hide the left and right activity bars (also in the View menu).
- A progress card while a folder opens, and "Reading changes N of M" in the status bar.
- MCP server and command line tool (`git-manager cli`) so AI tools such as Claude Code can use the app, off by default and only on 127.0.0.1 (Settings > Automation, Help > Available MCP Tools).
- Debug memory log (Settings > Automation) that writes memory changes to `~/.gitmanager/logs/memory.log`.
- File operations in the Files panel, like VS Code and JetBrains: New File, New Folder, Cut, Copy, Paste, Duplicate, Rename and Move to Trash from the right-click menu or the keys (Cmd+C, Cmd+X, Cmd+V, Cmd+D, F2, Cmd+Backspace), multi-select with Cmd-click and Shift-click, drag and drop to move (Option to copy), and files dragged in from the Finder are copied. Open tabs follow renames and moves; a move by drag asks first (Settings > Layout > Confirm drag and drop).
- MCP and command line tools for the Files panel operations: `create_file`, `create_folder`, `copy_paths`, and `rename_path`, `move_paths` and `trash_paths` (off by default), with the same unsaved-edit checks and tab follow-ups as the panel.
- IDE editing features, each with a switch in Settings > Editor > Editing features that frees its memory when off: auto-close brackets and quotes, code completion from the file's words and the language's keywords (Ctrl+Space, Enter or Tab to accept, optionally only on Ctrl+Space), fold arrows beside the line numbers, indent guides, highlighting the word at the cursor, scrolling past the end, column selection with Option+drag and a right margin line at a chosen column.
- Syntax colors for Go, Java, Kotlin, Swift, Ruby, shell scripts, TOML, XML, Dockerfile, C, C++ and C#, in the editor and in Markdown code blocks.
- Terminal polish like VS Code and JetBrains: split terminals side by side (Cmd+\\) with a draggable divider and split groups in the list, find in the terminal (Cmd+F) with Match Case, Words and Regex, Cmd+click file paths such as `src/app.ts:12:5` to open them at that line, drop files from Finder to type their quoted paths, rename a terminal by double-clicking its name, Paste, Find... and Split Terminal in the right-click menu, a visual bell, and GPU drawing (WebGL), Unicode 11 widths, smooth scrolling and Option as Meta, each with its own switch in Settings > Terminal.
- Quick Open and the Command Palette, like VS Code: Cmd+P finds files (recently opened first, `name:42` opens at a line) and Shift+Cmd+P runs any menu command, with recently used commands on top and each command's shortcut. Type `>` for commands, `:` to go to a line, `@` for the symbols of the file, `#` for symbols in the workspace and `?` for help. Search Everywhere (double Shift) stays as it is.
- Commit identity in Settings > Git: see and change your name and email for every repository (`git config --global`) or just one, with Use Global to drop a repository's own values. Before the first commit in a repository without a name and email, a small dialog asks for them instead of showing git's error.
- Commit message history: the clock in the commit box (Cmd+E, or Up in an empty box) lists your recent commit messages and messages that were typed but not committed, up to 30 per repository. It can be turned off in Settings > Git.
- Commit message templates: your own templates in Settings > Git with {branch}, {ticket} (like GM-12 from the branch name), {user}, {date} and {cursor}, picked from the commit box. A `commit.template` set in git config fills an empty commit box.
- A note under the commit box when the subject line is longer than 72 characters (Settings > Git > Subject line guide).
- Tabs come back after a restart: each folder or workspace reopens the file tabs it had, with their pinned state and caret, and loads a file only when its tab is first shown (Settings > Editor > Reopen tabs on start, on by default).
- Reopen Closed Tab (Shift+Cmd+T, File menu) brings back the last closed tabs, up to 20, at their place and caret.
- Tab limit in Settings > Editor: No limit, Single tab (a new file replaces the one on screen) or a number; past it the least recently used file tab closes, never one with unsaved changes or a pinned one. Pin Tab and Unpin Tab are in the tab's menu and the Window menu.
- Drag tabs to reorder them, like JetBrains: the other tabs slide aside while you drag, and Escape puts the tab back. Pinned tabs now sit at the start of the strip with a pin button that unpins them, and are kept by Close Others, Close to the Right and Close All. Dragging only reorders: an unpinned tab stops after the pinned ones.
- Wrap tabs in Settings > Editor, like VS Code: tabs that do not fit go onto more rows instead of scrolling sideways (off by default).
- Auto save like VS Code (Settings > Editor > Saving): after a delay (1000 ms by default) or when the focus leaves the editor. Conflicted files are only saved by hand.
- Optional clean-ups on save: trim trailing whitespace (Markdown line breaks stay), insert a final newline and trim final newlines, applied as one undo step.
- Custom keyboard shortcuts in Settings > Keyboard Shortcuts, like VS Code and JetBrains: search commands by name or by pressing keys, record new keys, remove or reset them, and see changed keys and conflicts. Keys macOS keeps (Cmd+Q, Cmd+H, Cmd+M, Cmd+Tab) cannot be taken. The menu bar, the window, the editors and the terminal all follow; the Command Palette opens the page with "Preferences: Open Keyboard Shortcuts". Custom keys are saved as `keybindings` in settings.json.
- Split editor, like VS Code's editor groups: Window > Split Right (Cmd+\) shows two groups of tabs side by side, each with its own tabs. The same file in both groups is one document, so edits, unsaved state and Save are shared. Move Tab to Other Group, Focus Left or Right Group (Cmd+1, Cmd+2), Close Group, Cmd+Enter in Quick Open and Open to the Side in the Files panel. Turn it off in Settings > Editor > Split editor.
- Compare any two files, like VS Code: in the Files panel use Select for Compare and then Compare with Selected, or select two files and use Compare Selected. On an editor tab (and in the File menu) Compare with Clipboard and Compare with... (pick a file in Quick Open). The diff opens in its own tab, uses unsaved edits, follows changes on disk, and shows images and PDFs side by side.
- Sticky scroll in the file editor, on by default: the first lines of the blocks you are in (up to five) stay at the top while you scroll. Click one to jump to it. Settings > Editor and View > Sticky Scroll.
- Minimap beside the scrollbar of the file editor, off by default: a small picture of the whole file with its syntax colors. Click or drag it to scroll. Settings > Editor and View > Minimap.
- Bracket pair colors, on by default: brackets get a color by how deep they are nested, in editors, diffs and the merge tool. Brackets in strings and comments are left alone.
- Highlight matching brackets can now be switched off in Settings > Editor.
- Local History, like JetBrains: a version of a file is kept on every save, when an open file changes outside the app, and before Discard, Discard Selected Lines, Rollback and File > Revert. Show Local History (tab menu, Files panel, File menu or the Command Palette) lists the versions with a diff against the current text, Revert to This (undoable in the editor) and Copy. Recently Deleted (File menu or a folder in the Files panel) brings back deleted files. Stored compressed in `~/.gitmanager/local-history`; Settings > Editor sets how many days (7) and how much space (200 MB) to keep, or clears it.
- Notification history: a bell in the status bar keeps every message of the session, newest first, with its time and any button that still works, counts unread errors and warnings, and has Clear All. Do Not Disturb (in the bell, View menu or Settings > Layout) keeps everything but errors from popping up.
- Auto fetch: every remote of each repository is fetched in the background while the window is in use (Settings > Git, on by default, every 10 minutes). It never asks for a password, waits longer after a failure and shows a small note in the status bar instead of an error.
- Git > Show Reflog: where HEAD or a branch pointed before, with Show Commit, Checkout Revision, New Branch Here and Reset Current Branch to Here.
- Git > Undo Last Action, and Undo in the toast after a commit, an amend, a reset or a checkout: takes back the last commit, amend, merge, pull, reset or checkout without losing local changes, and warns when the commit is already pushed. Deleting a branch offers Restore.
- Git > Bisect: start with a bad and a good commit, mark commits good, bad or skipped from the banner, the menu or the Log, see about how many steps are left, and open the first bad commit once found. The Log marks good, bad and tested commits.
- More than one window, like VS Code: File > New Window (Shift+Cmd+N), Open Folder in New Window, Cmd+click or right-click a recent folder on the welcome screen, and Close Window (Shift+Cmd+W, asks about unsaved edits). Opening a folder another window shows brings that window to the front. Each window has its own folders, tabs, terminals and menu state, its title is the workspace name (listed in the Window menu), settings changed in one window reach every window, and Settings > Layout > Reopen windows on start (on by default) brings back every window with its folders, size and position.
- Git > Open Repository in Browser opens the web page of the repository's remote on any host (GitHub, GitLab, Bitbucket, Azure DevOps, self-hosted); with several remotes, a list lets you choose.
- Restore Defaults in Help > Available MCP Tools puts the tool switches back to how they start: destructive tools off, every other tool on (only the tools the filter shows).
- Detect indentation, like VS Code, on by default: each file keeps the indentation it already has (tabs or spaces, and how many), so a file indented with 2 spaces is not edited with 4. The status bar shows Spaces: 2 or Tab Size: 4. Turn it off with View > Detect Indentation or in Settings > Editor; Tab size is used for files with nothing to follow.
- File icons, off by default: View > File Icons or Settings > Appearance picks No icons, Minimal (simple shapes colored by the theme) or Material Icons (colored icons for over 1,000 file types, from Material Icon Theme) for the Files panel, the Changes list and commit file lists. Each level loads only its own icons, and switching releases the others.
- Settings marks the settings that use clearly more memory with a small mark such as +70 MB, measured on the release app: GPU acceleration, scrollback, blame gutter, Markdown preview, file icons, render whitespace All and the tab limit. Point at a mark to see when the memory is used.

### Changed

- A long branch name in the Changes sidebar uses all the free room up to the repository name before it shortens, instead of stopping at a fixed width.
- Cmd+B (Ctrl+B on Windows and Linux) now shows or hides the Files panel, and Option+Cmd+B (Ctrl+Alt+B) the left sidebar; the two keys swapped. A key you set yourself in Settings > Keyboard Shortcuts stays as it is.
- The Branches and Stashes and Scripts panels have a title bar like Changes and Files, with Refresh and an X that hides the sidebar (Scripts keeps Collapse All there too). The Log toolbar has an X that hides the Log.
- The Discard changes button uses the same hooked arrow as VS Code, in the Changes sidebar, the Changes tab and the diff's line actions.
- Search Everywhere: the All tab lists Files first, then Classes and Symbols, so Enter right after typing opens the best matching file.
- Fetch, Pull, Push and Stash moved from the header to the Git menu (Fetch All Remotes, Pull..., Push..., Force Push..., Uncommitted Changes > Stash Changes...).
- Save and Revert moved from the editor toolbar to the File menu (Save, Save All, Revert File).
- Go to Line is now Cmd+L (it was Option+Cmd+G).
- Cmd+P (Edit > Go to File...) opens Quick Open instead of the Files tab of Search Everywhere; Shift+Cmd+O still opens that tab.
- The window shortcuts come from the same list as the menu bar, so each works with exactly the keys the menu shows: on macOS, Ctrl no longer stands in for Cmd (Ctrl+B, Ctrl+P), and on Windows and Linux tabs switch with Ctrl+PageDown and Ctrl+PageUp only. In a terminal on Windows and Linux, app keys with Ctrl+Shift (such as Ctrl+Shift+P) now reach the app instead of the shell.
- The "Merge and Log" settings section is now called "Git", and also holds the commit options and the Git Console switch.
- The hover-only buttons on a repository in the Changes sidebar became an always visible actions row with a ... menu.
- The file editor header is one slim bar, like JetBrains: the path, its badges and icon buttons for the change arrows, Blame, Copy relative path and the Markdown view switch, so the code starts right under the tabs. Conflict actions get their own strip only while a file has conflicts, and the bar shortens the path instead of wrapping when the editor is narrow.
- New editor defaults, like JetBrains: JetBrains Mono when it is installed (else Menlo) at 13 px, with line spacing 1.25. An existing settings.json keeps its saved values; Reset to Defaults picks up the new ones.
- The terminal starts at 13 px with a line height of 1.2 (it was 12.5 px and 1.0); sizes you saved stay. The terminal panel header and list are slimmer, and the header has a Split Terminal button.
- Faster terminal and Run tab output: big outputs such as a long `cat` or `yes` arrive in a few large messages instead of thousands of small ones, the app reads a command only as fast as the terminal can show it, so Ctrl+C stops the scrolling at once, and typing still echoes right away. The Scrollback setting now says how much memory it uses.
- Local images in the Markdown preview and the rich Markdown editor load straight from the file instead of being copied into memory as text, so big images use far less memory. SVG images show too, with a security policy that lets them run nothing.
- Typing in the rich Markdown editor stays quick in big files: after each pause only the edited blocks are written back and read again (a 5,000 line file took about 1 s per pause, now 1 to 2 ms).
- Image and PDF previews of a file in git history (HEAD, the index or a commit) read the file once instead of once per piece.
- The Branches sidebar builds its tree about 4 times faster with thousands of branches and tags, and the Log graph keeps long histories in about a third of the memory.
- Open file tabs stay quiet when nothing changed: saving reads nothing back and blames once, other tabs only check that their file and HEAD are the same, and the change markers are computed in the background after you stop typing. Typing in large files is faster too (conflict markers, the change bars and word completion no longer scan the whole file on every key), and the merge tool holds each side's text once.
- Faster refreshes in big repositories: saving a file reads the changes once, staging no longer reloads the Log or the branches, the Log reloads in one step and only when a branch, tag or HEAD moved, the Files panel lists folders again only when files are added, removed or renamed, and bursts of file changes (npm install, a big checkout) refresh every second or two instead of every 300 ms.
- The Files panel refreshes its open folders in one call per workspace folder, and folders that did not change answer in about 100 bytes each without being read again. Folder colors for changed files are worked out again only for repositories whose changes moved, Git LFS badges are checked only when HEAD, the index or files come and go (with no git-lfs process when nothing changed), and moving, cutting or trashing thousands of selected files no longer stalls on the selection.
- Dropping files on a closed folder checks for a name clash on disk without listing the folder.
- The MCP `list_directory` tool returns a page at a time (`limit`, `offset`, `nextOffset`) with names and flags only, so a huge folder no longer sends a huge answer.
- The status bar has a Sync item after the branch, like VS Code: it shows the commits to pull and push (such as 1↓ 2↑) and syncs on click, or publishes a branch that has no upstream. Long branch names are cut short so they no longer push the other items away.
- Clicking the repository name in the status bar opens a Select a Repository list, like VS Code, instead of the Branches sidebar. Its Auto entry (the default) makes the active repository follow the open tab; picking a repository keeps it active.

### Fixed

- With Rounded panels on, the terminal list and split terminals no longer cover the right edge of the terminal beside them.
- The terminal no longer shows a thin black strip below its last row.
- Screen readers read the fields with a button beside them in the Clone, New Worktree, Merge, Reset and Rebase dialogs by their label alone ("Clone into folder", not "Clone into folder Browse...").
- In a narrow sidebar, the buttons in the Changes title bar no longer slide under its close button; the CHANGES title gets shorter instead.
- Closing Markdown files with mermaid diagrams left the diagram library in memory until the app quit. Diagrams are now drawn in a hidden frame that goes away with the library and its cache 3 seconds after the last document with diagrams closes (after closing four such files: 264 MB instead of 342 MB, median of three runs).
- The welcome screen fits short windows: the recent lists scroll inside the card instead of the card being cut off at the top and bottom.
- The GPU acceleration and scrollback hints in Settings, Terminal gave wrong memory numbers ("a few MB" for GPU drawing); they now show measured ones: about 70 MB for the first GPU terminal, and about 2 KB per scrollback line.
- The terminal's visual bell no longer keeps restarting its flash when a command prints binary data that rings it thousands of times.
- Search Everywhere's All tab shows its Classes section again on big workspaces: the Classes and Symbols searches it runs at the same time no longer cancel each other.
- Diffs of large files no longer merge many small edits into one giant change: the lines that changed come from git-style line hunks, and only those are compared character by character.
- Stage All, Unstage All and Discard All work with tens of thousands of files (they failed with "Argument list too long").
- Links open in the browser again: Star on GitHub, the docs and release notes from the Help menu, update downloads, and links in Markdown previews and the terminal did nothing before.
- The current-line blame note no longer takes a line of its own or sits under the pointer and catches clicks: it is drawn after the end of the line without moving the code (on a long line, scroll right to read it; with word wrap on it is cut short), and opens the commit with Cmd+click (Ctrl+click elsewhere).
- Opening or adding a big folder no longer freezes the window for a moment.
- A selection inside one line is visible again; the current line highlight hid it.
- A folder or workspace that fails to open, at start or later, now shows an error naming the folder instead of silently showing the welcome screen.
- The Show all branches setting no longer claims to work like `git log --all`: the Log follows local and remote branches, not tags or stashes.
- New File and New Folder refuse a name with an empty part (`a//b`, a leading or trailing `/`) in the backend too, instead of quietly dropping it; names over 255 bytes are refused before anything is written, and the MCP `rename_path` tool counts bytes, not characters.
- Rename and New File warn about a name that differs only in case from one already in the folder on macOS and Windows, where the file system sees both as one name.
