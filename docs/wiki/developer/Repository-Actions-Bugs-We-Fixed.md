# Repository Actions Bugs We Fixed

The bugs we found in the repository row and its buttons (branch, Sync, Commit, Refresh and More Actions), why they happened and how we fixed them. How the row works is in [How Repository Actions Work](How-Repository-Actions-Work.md); the user side is in [Repository Actions](../usage/Repository-Actions.md).

**The Merging badge was cut off.**
- **The issue:** at 260 and 360 px, a merging repository showed "Mergin".
- **Why it happened:** the header button clipped its overflow, its name and badges never shrank, and the actions kept their full width.
- **The fix and why we chose it:** only the repository and branch names shrink (`minmax(0, max-content)` grid tracks), and the actions wrap below when not even four letters fit. Hiding the badge would hide the state.

**The buttons ran into the close button.**
- **The issue:** with one repository, its buttons sit in the Changes title bar. In a sidebar narrower than about 240 px the More Actions button slid under the X.
- **Why it happened:** `.repo-row-actions` has `min-width: 0` so a repository row can shrink it, but its buttons never shrink. In the title bar nothing set it back, so the box got narrower than its buttons and they spilled out over the X.
- **The fix and why we chose it:** the title bar gives it `min-width: auto` (as the repository row does), and the CHANGES title truncates instead. The title is the one thing you can do without; every button and the X stay usable down to the 200 px minimum, checked in WebKit at 200, 220 and 260 px.
