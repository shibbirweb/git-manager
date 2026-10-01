# How commit tabs work

A commit from the Log can open in its own editor tab, so its diff gets the whole editor area instead of the small pane under the list. For the user side, see [History and Log](../usage/History-and-Log.md#open-a-commit-in-a-tab).

## Why we need it

The details pane under the Log is good for a quick look, but it shares the height with the commit list. A big change is hard to read there. VS Code opens a commit's changes as an editor tab, and people coming from it expect the same: double-click, read it full size, close the tab when done, keep the Log where it was.

## How it works

A commit tab lives in the same tab strip as file tabs, so it gets every tab behavior for free: it sits next to files, closes with the tab menus, and is reused when you open the same commit again. The tab rules in `stores/tabs.ts` only know a tab by its `path`, so a commit tab gets a pseudo path from `commitTabPath(repoRoot, commitId)`, such as `commit:0f32e433...@/work/acme/storefront`. It never starts with `/`, so no folder or repository lookup can mistake it for a file.

```mermaid
sequenceDiagram
    participant LV as LogView
    participant RS as repoStore
    participant WS as Workspace.svelte
    participant CT as CommitTab.svelte
    participant CD as CommitDetails.svelte
    LV->>RS: openCommitTab(repoRoot, commitId, summary, filePath)
    RS->>RS: commitTabs[path] = summary and focus
    RS->>RS: applyTabs(openTab(path, pinned))
    WS->>CT: tab path starts with "commit:"
    CT->>CD: repoPath, commitId, preferredFile
    CD->>CD: getCommitDetails, getCommitFileDiff
```

The Log calls `openCommitTab` from four places: a double-click on a commit row, Enter in the list, **Open in Tab** in the details pane (and its right-click menu), and a double-click on a changed file. `CommitDetails` shows the button and the file double-click only when it gets an `onOpenInTab` callback, so inside the tab itself they are hidden.

`Workspace.svelte` renders `CommitTab` instead of `FileView` for a commit tab path. `CommitTab` parses the path back with `parseCommitTabPath` and renders the same `CommitDetails` the Log uses, at full size. A **Parent** link opens that commit in another tab. Because the tab can show any commit, not only loaded ones, every parent is clickable.

What the path cannot hold lives in `repoStore.commitTabs`: the subject for the tooltip, and `focus`, the file to show. `focus` carries a `token` that changes on every request, so asking for the same file again still switches to it. `applyTabs` drops the entry when its tab closes.

A few places used to assume every tab is a file and now check `isCommitTab`:

- `EditorTabs.svelte`: commit icon, short hash label (`tabLabels`), tooltip with the subject, and **Copy Commit Hash** instead of the path items.
- `StatusBar.svelte`: the repository comes from the commit tab, not from a file path.
- `FileExplorer.svelte`: it does not try to select a commit tab as a file.
- `repoStore.removeFolder`: commit tabs of repositories inside a removed folder close with it (`commitTabsInFolder`).

## Where the code lives

| File | What it does |
| --- | --- |
| `src/lib/stores/commitTabs.ts` | Pseudo paths: `commitTabPath`, `parseCommitTabPath`, `isCommitTab`, `commitTabsInFolder` |
| `src/lib/stores/repo.svelte.ts` | `openCommitTab`, the `commitTabs` record, cleanup in `applyTabs` |
| `src/lib/stores/tabs.ts` | `tabLabels` labels a commit tab with its short hash |
| `src/lib/log/CommitTab.svelte` | The tab's content: `CommitDetails` at full size |
| `src/lib/log/CommitDetails.svelte` | **Open in Tab** and the file double-click (`onOpenInTab`) |
| `src/lib/views/LogView.svelte` | Double-click, Enter and the menu item call `openInTab` |
| `src/lib/views/Workspace.svelte` | Picks `CommitTab` or `FileView` for each tab |
| `src/lib/views/EditorTabs.svelte` | Icon, label, tooltip and menu for commit tabs |

## Design decisions

**A pseudo path instead of a second kind of tab.** Opening, preview rules, closing, Close Others and the scroll-into-view all work on paths. Teaching them a second tab type would touch every one of them; a path that can never be a file reused them all. The rejected alternative was a separate list of commit tabs with its own strip logic.

**Reuse `CommitDetails`.** The tab and the Log pane show the same thing, so they share one component. A fix to one is a fix to both.

**Commit tabs open pinned.** A double-click or a button is a deliberate open, like a double-click in the Files panel, so the tab never replaces itself the way a preview tab does.

**No Back and Forward steps yet.** History stops are files, diffs and Log positions. A commit tab is not recorded, because a stop must be checkable when you go back to it, and that needs its own rule in `navHistory.ts`.

## Bugs we fixed

None are recorded yet. When you fix one, add it here with the issue, why it happened, and the fix and why you chose it.

## Tests

- `src/lib/stores/commitTabs.test.ts`: pseudo paths round-trip, files are never mistaken for commits, `commitTabsInFolder`, and the short hash label.
- The tab views are Svelte glue; check them by hand: double-click a commit, Enter, **Open in Tab**, a file double-click, a parent link, and closing.

## Keeping this page in sync

- Changing how a commit tab opens, looks or closes: update this page, [History and Log](../usage/History-and-Log.md), [Keyboard Shortcuts](../usage/Keyboard-Shortcuts.md) and `commit-tab.png`.
- Adding Back and Forward steps for commit tabs: update the decision above and [How navigation works](How-Navigation-Works.md).
- Any new code that walks `repoStore.tabs` must handle commit tabs (`isCommitTab`).
