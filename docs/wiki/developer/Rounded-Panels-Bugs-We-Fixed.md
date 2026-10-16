# Rounded Panels Bugs We Fixed

The bugs found in [rounded panels](How-Rounded-Panels-Work.md), what caused each, and why we fixed it the way we did. The user side is in [Rounded panels](../usage/Rounded-Panels.md).

**The editor did not stand out in Git Manager Dark.** In Git Manager Light the editor's tab strip showed as a white rounded panel on the grey window. In Git Manager Dark the frame and the editor were both `#1e1f22`, so the tabs and the top of the editor melted into the window and only the file toolbar showed. The frame was only checked against `--panel`, but in rounded mode the tab strip and the code take `--editor-bg`. The fix sets the Git Manager Dark frame to `#131416` (darker, like the gaps in the JetBrains Islands themes) and makes `frameColor()` and its test keep the frame apart from the editor color too. That also fixed Darcula, Nord, Gruvbox Dark and Rose Pine. Dark themes shade the darker surface, so the frame sits below both.

**The Changes tab lost the line between its list and the diff.** Its handle sits inside one panel but took the gap margins, pulling the diff 6px over the list's border. `ResizeHandle` now takes `inPanel` to keep its normal size, a prop so any handle inside a panel can opt out.

**The activity bars got a border and stood off the window edge.** After the move to the UI library, each bar showed a line beside the panel and a strip of frame between it and the window edge. The old app styles that put the bars on the frame went away with the app files, and `AppShell` had no rule for them. `AppShell` now pulls the first and last bar out to the window edge and gives the bar the frame color with no border, so every app built on the shell gets the same look.

**No line between the tabs and the code in dark themes.** PhpStorm's rounded editor shows a thin line under its tabs; ours showed none in Git Manager Dark. The rounded `TabStrip` drew its bottom border in `--border`, which in dark themes is the editor color itself, and the strip sits on the editor color too. The rounded look now keeps the strip's `--border-strong` line, the one the flat look uses, so it shows on every theme without a new color token.
