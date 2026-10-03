# Update Bugs We Fixed

The bugs found in [the update check](How-Updates-Work.md) and in opening links in the browser, what caused each, and why we fixed it the way we did. The user side is in [Updates](../usage/Updates.md).

**Links did not open.**
- **The issue:** Star on GitHub, Help menu links, update downloads and links in Markdown and the terminal did nothing, or showed "Could not open the browser".
- **Why it happened:** the capability listed only `opener:allow-open-url`. That permission allows the command but has no URL scope, so Tauri refused every URL.
- **The fix and why we chose it:** add `opener:allow-default-urls`, the plugin's own scope for `http`, `https`, `mailto` and `tel`. It is narrower than `opener:default` and needs no custom scope to maintain. A test in `lib.rs` reads the capability file and fails if either permission goes missing.

**Skip This Version did not stick.**
- **The issue:** after skipping a version, a manual Check Now opened the update window and presented the same version as new again.
- **Why it happened:** only the status bar item looked at `settings.skippedVersion`. The dialog read the plain list of newer releases.
- **The fix and why we chose it:** `isSkipped` and `announcedRelease` in `releases.ts` treat the skipped version and anything older as skipped. Automatic checks never announce it. A manual check still opens the window, since you asked, but marks it "You skipped this version." and offers Stop Skipping instead of Skip. That way you learn a newer version exists without being nagged.

**Update checks ran in mergetool mode.**
- **The issue:** every window git mergetool opened also started the timed update check.
- **Why it happened:** `updates.init()` armed the timer for every launch mode.
- **The fix and why we chose it:** `init()` reads the launch mode and does not schedule checks or show What's New in mergetool mode. These windows live for one file, so a check there only costs network and could pop up over the merge. `lastRunVersion` is left alone, so the next normal start still shows What's New.

## Keeping this page in sync

Add an entry here for every update or link bug you fix, in the format of [Docs and Screenshots](Docs-and-Screenshots.md), and keep the newest first.
