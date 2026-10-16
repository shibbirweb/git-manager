# Rich Markdown Bugs We Fixed

Bugs found in the [Rich Editor](How-the-Rich-Markdown-Editor-Works.md), what caused each, and why we fixed it the way we did. Older ones are listed in that chapter.

**Opening a Markdown file slid the whole window up.**
- **The issue:** on macOS, opening a Markdown file in the Rich Editor moved the whole app up under the title bar, with an empty band under the status bar. The document itself opened scrolled down. Other tabs stayed shifted until the app was restarted.
- **Why it happened:** ProseMirror keeps the view steady across an update. Where the browser supports CSS `overflow-anchor`, it leaves that to the browser; elsewhere it records the `scrollTop` of every ancestor up to the page and writes them back, moved by how far a reference line moved. It checks support with `view.dom.style.overflowAnchor == null`. WebKit, the macOS web view, has no `overflow-anchor`, so on load ProseMirror wrote 145px to every ancestor, `body` included, and each one that could scroll did. Chromium has the property, so the test browser pages never showed it.
- **How we found it:** `trace_scrolls` (see [Debugging with MCP](Debugging-with-MCP.md)) around `open_file` listed a `scrollTop` write to every ancestor, all from `restoreScrollStack` in ProseMirror's view.
- **The fix and why we chose it:** `richEditor.ts` sets `overflowAnchor = "auto"` on the editor's element. On WebKit that makes the check false, so ProseMirror stops moving the ancestors; on Chromium `auto` is already the default, so nothing changes there. Making every app container unscrollable instead would have hidden the next library that scrolls ancestors, not fixed this one.
