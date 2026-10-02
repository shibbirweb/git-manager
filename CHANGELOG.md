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

- JetBrains-style 3-way merge tool: Yours, Result and Theirs panes with connectors, apply, append and ignore per change, apply all non-conflicting changes, word-level highlights, synchronized scrolling, F7 navigation, full undo and ignore-whitespace mode.
- Conflicts dialog to accept yours or theirs for whole files (including binary and deleted files), then continue or abort the merge, rebase, cherry-pick or revert.
- Inline conflict actions in the editor: Accept Current, Accept Incoming, Accept Both and Resolve in Merge Tool, plus Mark as Resolved.
- Workspaces like VS Code: open any folder (git or not), nested repositories, several folders in one workspace, and workspace files compatible with `.code-workspace`.
- Changes sidebar grouped by repository with staging of files and hunks, discard, commit and amend.
- Editor tabs with preview tabs, git status letters in the Files panel, breadcrumbs, change markers on the scrollbar and next or previous change navigation.
- Git blame for the current line and a blame gutter, with click-through to the commit in the Log.
- Log with a branch graph, commit details and per-file diffs; cherry-pick, revert, reset and checkout.
- Open a commit in its own editor tab, like VS Code, so its diff gets the whole editor area: double-click it in the Log, press Enter, use Open in Tab, or double-click one of its files.
- Branches, tags and stashes sidebar; fetch, pull and push with progress.
- Back and Forward navigation across files, diffs and commits.
- Settings saved in `~/.gitmanager`: theme, fonts, ligatures, tab size, word wrap, blame, zoom with Ctrl or Cmd + mouse wheel.
- Status bar with the current repository, branch, cursor position and the app's memory use.
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
- Open File button in the diff toolbar, after Blame: opens the real file in an editor tab, at the same line when the right side is the working tree.
- View > Word Wrap (Option+Z) turns word wrap on or off in every open file at once, like VS Code.
- Editor cursor settings like VS Code (style: line, line thin, block, block outline, underline, underline thin; width; blinking: blink, smooth, phase, expand, solid; smooth caret animation) and Sublime Text's caret extra top and bottom, in Settings > Editor.
- Files panel: Select Opened File (the crosshair button) opens the folders down to the file you are editing, selects it and scrolls to it, like JetBrains.
- Scripts tool window: run npm, yarn, pnpm, bun, Composer, Make, Deno and just scripts from the left activity bar, in a Run tab with Rerun and Stop, with the Node version each package asks for.
- Search Everywhere (double Shift) with All, Classes, Files, Symbols and Text tabs, Go to File (Cmd+P), Go to Class (Cmd+O), Go to Symbol (Option+Cmd+O) and Find in Files (Shift+Cmd+F). Text selected in the editor fills the search field.
- Find and replace bar in the editor (Cmd+F, Cmd+R) with Match Case, Words and Regex, a match counter and Select All Occurrences, plus Replace in Files (Shift+Cmd+R), which skips files with unsaved edits.
- Code menu commands: comments, duplicate, delete, join, move, indent, toggle case and sort lines, folding, Go to Line, and Select Next Occurrence (Cmd+D) for multiple cursors.
- Markdown editor: formatting toolbar, live preview with linked scrolling, mermaid diagrams and local images, as Editor Only, Editor and Preview, or Preview Only.
- Preview Only edits the rendered Markdown page in place and keeps untouched text exactly as it was.
- 37 color themes, with one pick for light mode and one for dark mode, in Settings > Editor.
- Settings > Editor: Line spacing and Render whitespace, applied to the editor, diffs and the merge tool.
- Resizable side-by-side diffs: drag the line between the two sides, or double-click it for 50/50.
- Header buttons to show or hide the left and right activity bars (also in the View menu).
- A progress card while a folder opens, and "Reading changes N of M" in the status bar.
- MCP server and command line tool (`git-manager cli`) so AI tools such as Claude Code can use the app, off by default and only on 127.0.0.1 (Settings > Automation, Help > Available MCP Tools).
- Debug memory log (Settings > Automation) that writes memory changes to `~/.gitmanager/logs/memory.log`.

### Changed

- Fetch, Pull, Push and Stash moved from the header to the Git menu (Fetch All Remotes, Pull..., Push..., Force Push..., Uncommitted Changes > Stash Changes...).
- Save and Revert moved from the editor toolbar to the File menu (Save, Save All, Revert File).
- Go to Line is now Cmd+L (it was Option+Cmd+G).
- The "Merge and Log" settings section is now called "Git", and also holds the commit options and the Git Console switch.
- The hover-only buttons on a repository in the Changes sidebar became an always visible actions row with a ... menu.

### Fixed

- Opening or adding a big folder no longer freezes the window for a moment.
- A selection inside one line is visible again; the current line highlight hid it.
- A folder or workspace that fails to open, at start or later, now shows an error naming the folder instead of silently showing the welcome screen.
- The Show all branches setting no longer claims to work like `git log --all`: the Log follows local and remote branches, not tags or stashes.
