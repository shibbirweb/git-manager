# Docs and screenshots left to write

The wiki rules are in `CLAUDE.md` ("Documentation"). Write the docs only after the user has tested the features in
the real app, so the pages match what the app shows.

## How to do one feature

1. Open its note in [doc-notes/](doc-notes/) (ids are in [README.md](README.md)).
2. Check every label, setting, default and shortcut in the code and the running app.
3. New feature: add it to `docs/wiki/features.json`, write the user page in `docs/wiki/usage/` and the developer
   chapter in `docs/wiki/developer/How-*.md` (why we need it, how it works with mermaid diagrams, where the code lives,
   design decisions, tests, keeping in sync), and add its screenshots to `scripts/screenshots.ts`.
4. Changed behavior: update the user page and developer chapter, and retake the affected screenshots.
5. Bug fix: add a "Bugs we fixed" entry (what the user saw, why, the fix and why it was chosen). Drafts are in
   the notes.
6. Keep pages between 300 and 1000 words (the check fails over 1200): split rather than grow.
7. Run `bun scripts/build-wiki.ts --check`.

## Screenshots

- Take them from the real app through the dev IPC bridge: run the app with `GM_IPC_BRIDGE=1 bun tauri dev` on the demo
  from `scripts/make-docs-demo.sh`, then `bun scripts/screenshots.ts <name ...>`. Never point the bridge at a real
  repository or `~/.gitmanager`. View every image before committing.
- Earlier list still open: [screenshots-to-retake.txt](screenshots-to-retake.txt) (49 retaken but not all viewed,
  the rest still to take, plus the new terminal-find.png and terminal-split.png). `media-preview-pdf.png` stays a
  manual capture, since the screenshot browser cannot draw PDFs.
- Each note in [doc-notes/](doc-notes/) lists the new screenshots for its feature.

## Checklist

New user pages and developer chapters:

- [ ] A1 Quick Open and Command Palette
- [ ] A2 Keyboard shortcuts settings
- [ ] A3 More than one window
- [ ] A45 Local History, and notification history
- [ ] E12 Tabs (restore, Reopen Closed Tab, tab limit, Single tab, Pin Tab), auto save and save clean-ups
- [ ] E3 Split editor
- [ ] E45 Compare files; sticky scroll, minimap, bracket colors
- [ ] G1 Stage selected lines
- [ ] G45 Commit identity; commit message history and templates
- [ ] G236 Auto fetch; reflog and Undo; bisect

Changed pages and "Bugs we fixed" entries (optimizations):

- [ ] O1 refresh pipeline (Log, Changes, Files panel, watcher chapters)
- [ ] O2 editor, diffs and blame chapters
- [ ] O3 Files panel and LFS chapters, MCP `list_directory` changes
- [ ] O4 terminal chapters (the `terminal-exited` event, the 250 ms timer and the three-thread design are gone)
- [ ] O5 Markdown and Search Everywhere chapters

Earlier docs work still open (from before this batch):

- [ ] Take terminal-find.png and terminal-split.png, then replace the two `[TODO: screenshot ...]` lines in
      usage/Terminal-Features.md with the image links and add both names back to the terminal feature's
      "screenshots" list in docs/wiki/features.json.
- [ ] Check the editor-feel, path bar, terminal polish, GPU popup and Branches popup pages against the real app:
      usage/Editing-Code.md, usage/Editor-and-Tabs.md, usage/Terminal.md, usage/Terminal-Features.md,
      usage/Status-Bar-and-Help.md, usage/Settings.md, usage/Settings-Terminal-and-Automation.md,
      usage/Keyboard-Shortcuts.md, usage/Keyboard-Shortcuts-Editor.md and their developer chapters.
- [ ] "Bugs we fixed" entry for the hidden terminal frame catching clicks (How-Terminal-Features-Work.md).
- [x] Editing-Code split: the Code Appearance page and How-Code-Appearance-Works chapter (2026-10-03).
- [ ] Pages near the word limit (Status-Bar-and-Help, Settings at about 1190 words, the Markdown chapter): split them.
- [ ] Settings-Reference.md: every new settings key and default from the notes. (`detectIndentation` is in already.)
- [ ] Keyboard shortcut pages: Cmd+P, Shift+Cmd+P, Shift+Cmd+T, Cmd+\, Cmd+1, Cmd+2, Cmd+E in the commit box, the
      line staging keys, and the changed Go to File key (now Shift+Cmd+O for the Search Everywhere Files tab).
