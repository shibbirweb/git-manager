# Remaining work

Status on 2026-10-03: every feature below, A3 included, is merged, passes all four checks and is **committed** on
`feat/GM-8-terminal-git-menu-search-themes` (one commit per feature, not pushed). Parts were tried in the real app
through the MCP tools; the full manual test by the user is still open.

## Where the code is

- **Committed** on the branch, on top of `5cb76d0`. Not pushed.
- **Backups** (can go once the commits are pushed): `refs/gm-backup/int` (before A3), `refs/gm-backup/int-a3` (with A3,
  before the 7 newer branch commits), `refs/gm-backup/a3-base`, and the patches in
  `~/.claude/projects/-Users-shibbir-Personal-git-merger/docs-resume/patches/`.

## Next steps, in order

1. DONE: merge A3 (kept both sides in CHANGELOG.md, types.ts, settingsData.test.ts).
2. DONE: `mcp::tests::the_cli_reports_a_switched_off_tool` passed in the full run and 5 of 5 MCP runs with A3; not
   caused by A3.
3. DONE: all four checks, then again after merging the 7 newer branch commits (1547 Vitest, 623 cargo tests, clippy
   clean).
4. DONE: copied into the main tree.
5. PARTLY DONE: tried through the MCP tools (below). The user still tests by hand, with the list below.
6. DONE: committed, split by feature. Push only when told.
7. Docs and screenshots: [docs-and-screenshots.md](docs-and-screenshots.md).
8. Clean up: remove the worktrees under the old scratchpad (`git worktree prune`), its shared `cargo-target`, and
   `refs/gm-backup/*` (`git update-ref -d`).

## Added after the batch (2026-10-03, committed)

- DONE: `get_app_state` and `close_dialog` know the Local History dialog and the notifications popup.
- DONE: Restore Defaults in Help > Available MCP Tools.
- DONE: Detect indentation (View > Detect Indentation, Settings > Editor; the status bar shows Spaces: 2 or Tab Size: 4),
  with its docs. Editing Code was split: the new Code Appearance user page and developer chapter.

## Decision waiting for the user

- **Local History index (A45):** one small index file per tracked file, not one per workspace, so a save touches one
  file and history follows a file whichever folder opens it. Changing it stays inside `src-tauri/src/local_history/store.rs`.

## Check in the real app

Tried through the MCP/CLI tools on 2026-10-03 (no screenshots, Screen Recording is not allowed), marked DONE below
where it passed. Everything else still needs the user, and everything that writes should use a demo repository.

- DONE: every new menu command is listed with its keys and enabled state.
- DONE (A1): Quick Open and the Command Palette open, list and close.
- DONE (E12, E3): split, Pin Tab, Close Tab, Reopen Closed Tab, tabs restored after a reload.
- DONE: status bar branch cap and Sync item; the bell popup; Show Reflog; the Local History dialog; New Window opens.
- Noticed: pinning a file open in both groups shows the pin on both tabs; `get_app_state` does not list editor groups
  or pinned tabs.


- **O1:** the Changes list updates about 300 ms after a save (from the watcher); the Files panel updates on add,
  delete, rename and `.gitignore` edits; the Log does not reload on stage or save but does on commit, checkout,
  fetch and tag; a long `npm install` refreshes about every 1 to 2 s.
- **O2:** big diffs show separate changes; change bars while typing; word completion; blame after save and commit;
  the raw-bytes commands (`line_change_marks`, `blame_contents`) work in the app.
- **O3:** one re-list after file operations; a move clash toast before the confirm; LFS badges after
  `git lfs track` and after commits; tones in multi-repo workspaces.
- **O4:** typing echo is instant; Ctrl+C on `yes` stops at once; a big `cat` is smooth with flat memory; `exit`
  closes the tab at once; Run tab Stop and Rerun.
- **O5:** local PNG and SVG images in the Markdown preview and rich editor; the Search Everywhere All tab shows
  Classes on a big workspace; a PDF from history loads; typing in the rich editor on a big README.
- **A1:** popup look in light and dark; focus returns on Escape; `:` and `@` move the caret; first open does not
  drop keys.
- **A2:** the menu shows a new key at once; recording swallows Cmd+W, Cmd+S, Cmd+,; open editors pick up changes.
- **A3:** New Window; opening a folder that is open elsewhere focuses it; quit and relaunch restores windows; menu
  state follows focus; settings reach other windows; terminals close with their window; MCP with two windows.
- **A45:** the bell, its popup and the warning toast; the Local History window and Recently Deleted; Revert to This
  then Undo; external-change versions; the new Settings rows.
- **E12:** tabs restored after restart, loading only when shown; Shift+Cmd+T; pin icon; Single tab and the limit;
  auto save on blur, window blur and tab switch; clean-up undo.
- **E3:** the splitter and focus between groups; typing in the same file on both sides with undo, save and auto
  save; moving a tab with unsaved edits; Cmd+\, Cmd+1, Cmd+2 inside editors.
- **E45:** sticky scroll alignment, horizontal scroll and click; minimap position, theme colors and dragging;
  bracket colors per theme; compare tab live updates, images and PDFs, clipboard, "Compare with...".
- **G1:** toolbar crowding; the right-click menu; the Undo button; the macOS keys; a refresh keeps the scroll;
  discard under autocrlf.
- **G45:** the "Who is committing?" dialog and Save and Commit; the history and template icons and menus; the caret
  at `{cursor}`; the `commit.template` prefill; Cmd+E.
- **G236:** auto fetch pauses when the window is hidden or minimized; the Bisect submenu; banner colors; Undo and
  Restore buttons; reflog scrolling; the status bar hint.

## Follow-ups the agents skipped

- **A1:** no live preview while moving through `:` or `@` results.
- **A2:** one key per command; double Shift cannot be turned off.
- **A45:** no snapshot before checkout, reset --hard, stash or Move to Trash; the notification list is not saved
  across restarts.
- **E12:** pinned tabs are still closed by Close Others and Close All and do not move to the left.
- **E3:** no dragging tabs between groups; the second editor of a file starts at the top.
- **E45:** sticky scroll has no push-up effect; compare tabs are not restored after a restart.
- **G1:** no gutter checkboxes for lines.
- **G236:** no Undo for a rebase; a deleted branch is remembered only for the session; the bisect banner shows for
  the active repository only.
- **G45:** identity is not checked before merge continue, cherry-pick, revert or stash.
- **O2:** big texts are still sent as JSON strings; `navigation.fileExists` reads the whole file.

## Not started

- **A6, installing updates in the app:** needs a Tauri updater signing key that the user creates, and a release CI
  change. Ask first.
- **Windows and Linux builds:** still planned work.
