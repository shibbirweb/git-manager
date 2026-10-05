# Plans: work left after the GM-8 basics batch

This folder holds the work we left for later, so it can be picked up in a new conversation. Start here, then
open the file for the part you are doing.

| File | What it covers |
|---|---|
| [remaining-work.md](remaining-work.md) | Code still to finish or merge, checks in the real app, follow-ups the agents skipped |
| [docs-and-screenshots.md](docs-and-screenshots.md) | The wiki pages, developer chapters and screenshots we did not write yet |
| [screenshots-to-retake.txt](screenshots-to-retake.txt) | The screenshot list from the earlier editor change (49 retaken, the rest still to take) |
| [windows-release.md](windows-release.md) | The Windows audit: what is ready, the blockers, and the work in order |
| [doc-notes/](doc-notes/) | One note per feature, written by the agent that built it: pages to add or change, mermaid ideas, settings lines, "Bugs we fixed" drafts, screenshots |

## How to resume

1. Read [remaining-work.md](remaining-work.md) and do its "Next steps" in order. The code comes first, then the
   real-app checks, then the docs.
2. For the docs, follow [docs-and-screenshots.md](docs-and-screenshots.md) one feature at a time. Each feature has a
   note in [doc-notes/](doc-notes/) with the facts to write from. Check every label, setting and shortcut in the code
   and the running app before writing it.
3. Tick off items in these files as they are done, and delete this folder once everything is in the wiki.

## Feature ids used in the notes

| Id | Feature |
|---|---|
| O1 | Faster refreshes: watcher change kinds, one Log call, unchanged status, paths over stdin |
| O2 | Faster editor and diffs: file versions, change marks and hunks in Rust, smaller blame |
| O3 | Faster Files panel and LFS: batched stamped listings, LFS stamp, shared name rules |
| O4 | Faster terminal output: merged messages, flow control, exit in the channel |
| O5 | Markdown images through gmpreview, rich editor sync, Search Everywhere All tab fix |
| A1 | Quick Open (Cmd+P) and the Command Palette (Shift+Cmd+P) |
| A2 | Custom keyboard shortcuts |
| A3 | More than one window |
| A45 | Local History (A4) and notification history (A5) |
| E12 | Reopen tabs, Reopen Closed Tab, tab limit and Single tab, Pin Tab (E1); auto save and save clean-ups (E2) |
| E3 | Split editor |
| E45 | Compare any two files (E4); sticky scroll, minimap, bracket colors (E5) |
| G1 | Stage, unstage and discard selected lines |
| G45 | Commit identity (G4); commit message history and templates (G5) |
| G236 | Auto fetch (G2), reflog and Undo (G3), bisect (G6) |
