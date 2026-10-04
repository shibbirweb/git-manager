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

## Screenshots left from the 2026-10-04 features

Paused on 2026-10-04: the user will take these later. The pages are written; only the images are missing or out of
date. Take them all in one session, view each image, then run `bun scripts/build-wiki.ts --check`.

New shots. Each has a `define(...)` in `scripts/screenshots.ts` and a `[TODO:name.png]` marker in its page; replace
the marker with the image link once it is taken (the wiki check lists them as pending until then):

- [ ] `navigation-bar` (usage/Navigation-Bar.md): the path bar with the file's folder listed and the file selected.
- [ ] `navigation-bar-bottom` (usage/Navigation-Bar.md): File toolbar set to Bottom, the whole bar under the code with
      its list opened upward.
- [ ] `navigation-bar-hidden` (usage/Navigation-Bar.md): File toolbar set to Hidden, the floating bar at the top left of
      the editor after Cmd+Up.
- [ ] `recent-files` (usage/Recent-Files.md): the Cmd+E popup with the previous file selected.
- [ ] `editor-font-weight` (usage/Code-Appearance.md): the font weight slider and its preview.
- [ ] `rounded-panels` and `rounded-panels-islands-light` (usage/Rounded-Panels.md).
- [ ] `settings-memory-flags` (usage/Memory-Use.md): the +N MB marks in Settings.
- [ ] `file-icons` (usage/File-Icons.md), `tabs-pinned` and `tabs-wrapped` (usage/Pin-Reorder-and-Wrap-Tabs.md): older
      ones still pending.

Retakes. These images exist but no longer match the app:

- [ ] `settings-appearance.png`: new rows Rounded panels and File toolbar, with the File toolbar switches
      (Breadcrumbs, Badges, Change arrows, Blame, Copy relative path, Markdown view switch, Markdown formatting row).
- [ ] `settings-editor-fonts.png`: the new Editor font weight row.
- [ ] `color-theme-pickers.png`: the theme lists are longer (Islands Light and Dark, VS Code Light+ and Dark+).
- [ ] `empty-main.png`: the welcome screen now has the Navigation Bar on top and a sixth button, Navigation Bar
      (Cmd+Up); the shot now clips from the top of the editor area.
- [ ] Path bar shots, check and retake if they look different: the crumbs are now buttons and the file crumb shows the
      file type icon. `editor-tabs.png`, `editor-change-markers.png`, `editor-conflict-toolbar.png`,
      `markdown-toolbar.png`, `markdown-split.png`, `markdown-rich-editor.png`, `markdown-mermaid.png`.

Open question for the user: the wiki still calls the bar above the code the "path bar" (usage/Editor-and-Tabs.md
"The path bar", developer/How-the-Path-Bar-Works.md), while the setting is now named File toolbar. Rename the docs to
"file toolbar" or keep both names.

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
