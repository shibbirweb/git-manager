# Remaining work

Status on 2026-10-03: every feature below is built and tested by its own checks, but nothing is committed and
nothing has been tried in the real app.

## Where the code is

- **Merged and tested:** everything except A3, in the integration worktree
  `/private/tmp/claude-501/-Users-shibbir-Personal-git-merger/0ea45078-82cb-455c-8e0f-764dfe3e99a9/scratchpad/wt/int`
  (changes staged, not committed). Checks there: `bun run check` clean, 1504 Vitest tests, 601 cargo tests, clippy clean.
- **Backups**, in case that temporary folder is gone:
  - `~/.claude/projects/-Users-shibbir-Personal-git-merger/docs-resume/patches/int-combined.patch`. Apply it onto
    commit `ee3f456` with `git apply --index`.
  - The same state as the git object `refs/gm-backup/int` in this repository (not a branch).
  - One patch per feature in the same `patches/` folder.
- **A3, more than one window:** coded but not merged. Its patch is `docs-resume/patches/wip-a3.patch`, based on
  `refs/gm-backup/a3-base` (an older integration state). Its resume note is `docs-resume/resume/a3.md`.

## Next steps, in order

1. Merge A3 into the integration worktree (`git apply --3way --index wip-a3.patch`) and fix the conflicts. Its
   CHANGELOG line ("More than one window, like VS Code...") comes with the patch; leave it out if a beta ships
   without A3.
2. Check `mcp::tests::the_cli_reports_a_switched_off_tool`: it failed once in A3's full run and passes alone.
   Run it on the integration state without A3 too, to see whether A3 caused it.
3. Run all four checks: `bun run check`, `bun run test`, `cargo test`, `cargo clippy --all-targets`.
4. Tell the user, then copy the integration changes into the main tree (their `bun tauri dev` rebuilds).
5. The user tests in the real app (list below). Fix what they find.
6. Commit only when the user says "commit", split by feature (`feat:[GM-8] ...`, `fix:[GM-8] ...`). The CHANGELOG lines
   are already written. Push only when told.
7. Then the docs and screenshots: [docs-and-screenshots.md](docs-and-screenshots.md).
8. Clean up: remove the worktrees under the scratchpad (`git worktree prune`), the shared `cargo-target` there, and
   `refs/gm-backup/*` (`git update-ref -d`).

## Decision waiting for the user

- **Local History index (A45):** one small index file per tracked file, not one per workspace, so a save touches one
  file and history follows a file whichever folder opens it. Changing it stays inside `src-tauri/src/local_history/store.rs`.

## Check in the real app

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
