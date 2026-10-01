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
- Settings saved in `~/.gitmanager`: theme, fonts, ligatures, tab size, word wrap, blame, zoom with Ctrl + mouse wheel.
- Status bar with the current repository, branch, cursor position and the app's memory use.
- Works as `git mergetool`.
- Update check: notify-only checks for new releases on the stable or beta channel, with release notes and a download link, plus What's New after an update.
- Settings, About: star the project on GitHub, report a bug (with your version filled in) or request a feature.
- A wiki with a user guide (with screenshots of every feature) and developer docs, published from `docs/wiki`.
