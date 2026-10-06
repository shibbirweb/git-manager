# Folder Watching Bugs We Fixed

The bugs found in [folder watching](How-Folder-Watching-Works.md) and in the views that follow it, what caused each, and why we fixed it the way we did.

**Adding a second folder stopped watching the first.**
- **The issue:** only the newest folder refreshed on its own.
- **Why it happened:** `watch_workspace` still called `watchers.clear()`.
- **The fix and why we chose it:** watchers are keyed by folder root, so each folder stays independent.

**A new repository only showed up after Scan for Repositories.**
- **The issue:** after `git init` or a clone in an open folder from outside the app, the repository did not appear.
- **Why it happened:** a new `.git` only reloaded the Files panel, and changes inside an unknown `.git` were dropped.
- **The fix and why we chose it:** `attribute` sets `reposChanged` in the cases above, and the store rescans only then, once the burst settles, doing nothing more if the list is the same.

**An open log file never updated.**
- **The issue:** a log file open in a tab, while another app kept writing to it, showed only what it had when it opened, in a preview tab or a normal one.
- **Why it happened:** log files are usually ignored, and `attribute` dropped every ignored path, so no event reached the tab.
- **The fix and why we chose it:** the page tells the watcher which files are open, and an ignored open file is reported with `open-files-changed`. Watching only open files keeps builds quiet. The reload now replaces only the new lines, so the view does not jump, and it follows the end like `tail -f` when scrolled there.

**A tracked file that matched an ignore rule never refreshed.**
- **The issue:** a file committed before a `.gitignore` rule matched it (a tracked log, say) did not update its status, diff or tab when it changed.
- **Why it happened:** the watcher asked only whether a rule matched the path, not whether git tracks it.
- **The fix and why we chose it:** `IgnoreCheck` treats a tracked path as visible, like git status does. It reads the index only when a rule matched, so most batches never read it.

**A diff on screen did not follow a file that changed again.**
- **The issue:** in the Changes tab, Show Diff with Working Tree and Compare with Revision, the diff of a file that was already modified stayed as it was while another app kept changing the file.
- **Why it happened:** these views reloaded only when the repository's status object changed, and an unchanged status keeps its object, so a second edit of a modified file did nothing.
- **The fix and why we chose it:** they also follow `repoStore.fileVersions[repoRoot]`, which the watcher bumps on every work tree change, like the Changes sidebar diff already did.
