# Color Theme Bugs We Fixed

The bugs found in the [color themes](How-Color-Themes-Work.md), what caused each, and why we fixed it the way we did. The user side is in [Color Themes](../usage/Color-Themes.md).

**Tag and attribute colors never showed.**
- **The issue:** tags in HTML, XML, Vue and JSX had the type color (Monokai tags were cyan).
- **Why it happened:** `classHighlighter` has no class for `tagName` or `attributeName` and uses their parents, `typeName` and `propertyName`, so the `.tok-tagName` and `.tok-attributeName` rules never matched.
- **The fix and why we chose it:** a second highlighter for just those two (the UI library's `editor/highlighter.ts`) now runs everywhere code is highlighted. It only adds classes, so nothing else changed.

**Black text on blue buttons in light themes.**
- **The issue:** Primary and Danger buttons and count badges in Islands Light, One Light and the other light themes had black text that was hard to read.
- **Why it happened:** `catalog.ts` picked whichever of white and black had the higher contrast ratio with the accent. On mid blues such as `#3871e1` black scores a little higher (4.8 against 4.4), even though white reads better there.
- **The fix and why we chose it:** white wins whenever it reaches 3:1 on the accent, the bar the readable button text test already used, and the dark text is kept only for pale accents such as yellow or cyan. That matches the source apps (JetBrains, VS Code, GitHub) and the built-in themes, which all put white on their blue buttons. A test in `catalog.test.ts` checks this for every theme.
