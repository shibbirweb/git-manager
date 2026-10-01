# How the status bar works

The status bar runs along the bottom of the window: on the left the repository of whatever is on screen, on the right the open file's cursor and format, update news, the running operation, help links and memory use. For the user side, see [Status Bar and Help](../usage/Status-Bar-and-Help.md).

## Why we need it

In a workspace with many repositories, it is easy to lose track of which repository and branch a file belongs to. VS Code's status bar follows the active editor, and people expect the same.

Memory is a feature of this app (see [Architecture](Architecture.md)), so we show it honestly, counted the way Activity Monitor counts it. And when something goes wrong, reporting it should take one click, with the version already filled in.

## How it works

Everything is in `StatusBar.svelte`, which reads existing stores and one Tauri command.

```mermaid
flowchart LR
    subgraph Left
        R["Repository name"]
        B["Branch, ahead and behind"]
        C["Changes count"]
        X["Conflicts"]
        O["Operation in progress"]
    end
    subgraph Right
        F["Ln, Col, Spaces, LF or CRLF, language"]
        U["Update available"]
        W["Busy label"]
        S["Star and bug buttons"]
        M["Memory"]
    end
    RS["repoStore statuses"] --> Left
    ES["editorStatus"] --> F
    UP["updates"] --> U
    RS --> W
    MU["memory_usage command"] --> M
```

### Following the screen

`contextRepo` decides which repository the left side describes:

```mermaid
flowchart TD
    A["changesSelection.shownView"] --> B{"Which view?"}
    B -->|"file"| C["locateAbsolute(repos, openFilePath)"]
    C --> C2{"Inside a repository?"}
    C2 -->|"yes"| R1["That repository"]
    C2 -->|"no"| R0["Show No repository"]
    B -->|"diff"| D["Repository of the selected change"]
    B -->|"log or none"| E["The active repository"]
```

Branch, ahead and behind, the changes count, conflicts and the operation come from `repoStore.statuses[contextRepo.root]`, with no extra git call. Clicking the repository or branch makes that repository active and opens Branches. Clicking changes opens the Changes panel, and clicking conflicts opens that repository's Conflicts dialog. Spaces opens Settings on the Editor section (`settings.openDialog("editor")`).

The file details come from `editorStatus` (`stores/editorStatus.svelte.ts`). The visible `FileView` calls `editorStatus.report(info)` with line, column, selection, line endings, tab size and language (from `languageName` in `editor/setup.ts`). `report` ignores unchanged info, so the bar does not re-render, and the bar shows it only when its `filePath` matches the open tab.

### Memory

```mermaid
sequenceDiagram
    participant SB as StatusBar
    participant API as api.ts
    participant CMD as commands/config.rs
    participant MEM as memory.rs
    participant OS as macOS libproc
    loop every 5 s while the window is visible
        SB->>API: memoryUsage()
        API->>CMD: invoke memory_usage
        CMD->>MEM: usage()
        MEM->>OS: responsible pid of this app
        MEM->>OS: list all pids, keep com.apple.WebKit helpers with the same responsible pid
        MEM->>OS: proc_pid_rusage, phys_footprint of each
        MEM-->>SB: MemoryUsage total, processes, approximate
    end
```

On macOS the UI runs in WebKit helper processes, which Activity Monitor charges to the app, so we do too. `memory.rs` calls `responsibility_get_pid_responsible_for_pid` for our own process, then keeps every `com.apple.WebKit*` process with the same responsible process, and sums `phys_footprint` from `proc_pid_rusage`. That is Activity Monitor's "Memory" column.

When the app is started from a terminal (as `bun tauri dev` does), macOS makes the **terminal** the responsible process, so its other WebKit helpers would match too. In that case `approximate` is set and a helper must also have started after our process (`proc_start_abstime`). The details popover says so.

Polling stops on `visibilitychange` when the window is hidden. On other platforms `usage()` returns zero and the memory item is hidden.

### Help links

The star button calls `updates.openRepository()`. The bug button opens a small menu with **Report a Bug** and **Request a Feature**. `bugReportUrl(version, platform)` in `update/releases.ts` builds a GitHub new-issue link for the `bug_report.yml` form with `version` and `platform` filled in. `updates.reportBug()` asks the backend with `api.osInfo()` (`os_info`: `sw_vers -productVersion` on macOS, `/etc/os-release` on Linux, "Windows" on Windows) and `osLabel` makes "macOS 15.4.1". WebKit freezes the macOS version in the user agent at 10.15.7, so `platformName(navigator.userAgent)` is only a fallback and gives just the family name, such as "macOS". The field ids in `.github/ISSUE_TEMPLATE/bug_report.yml` must match those parameter names. The same links are in Settings, About.

## Where the code lives

| File | What it does |
| --- | --- |
| `src/lib/views/StatusBar.svelte` | The bar: context repository, file details, update item, links, memory popover |
| `src/lib/stores/editorStatus.svelte.ts` | Cursor and file details of the visible editor |
| `src/lib/views/files/FileView.svelte` | Reports cursor details while it is the visible tab |
| `src/lib/editor/setup.ts` | `languageName` |
| `src/lib/stores/workspacePaths.ts` | `locateAbsolute` |
| `src-tauri/src/memory.rs` | macOS process memory, WebKit helper matching |
| `src-tauri/src/commands/config.rs` | `memory_usage`, and `os_info`: the OS name and version |
| `src/lib/update/releases.ts` | `bugReportUrl`, `featureRequestUrl`, `osLabel`, `platformName` |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | The bug form whose fields are pre-filled |

## Design decisions

**Count the WebKit helpers.** Showing only our own process would be misleading, since most memory is the web view. Matching Activity Monitor lets users check the number.

**Poll, but only while visible.** A 5 second poll is cheap, and skipping it in the background keeps idle CPU at zero.

**Reuse statuses, do not query.** The status of every repository is already in memory, so following the screen is only a `$derived`.

**Pre-fill, do not collect.** The bug link carries the version and OS in the URL, and the user sees and sends the form themselves. The app gathers no other data.

## Bugs we fixed

**The dev build found no WebKit helpers.**
- **The issue:** the first memory probe found no WebKit helpers for the dev build, so only the app process was counted.
- **Why it happened:** the dev build starts from a terminal, and macOS made the terminal the responsible process, so no helper pointed at our pid.
- **The fix and why we chose it:** match helpers on whatever process is responsible for us, and when that is not us, also require a later start time and mark the result approximate. A Finder launch, what users run, stays exact.

**The bar ignored the file on screen.**
- **The issue:** the status bar always showed the active repository, even while you read a file from another one.
- **Why it happened:** it read `repoStore.repo` directly.
- **The fix and why we chose it:** `contextRepo` follows the visible file tab or diff, like VS Code, and falls back to the active repository.

**Spaces opened the wrong Settings section.**
- **The issue:** the Spaces item says the tab size is in Settings, Editor, but clicking it opened Settings on Appearance.
- **Why it happened:** the Settings dialog always started on Appearance, and callers could only open it, not pick a section.
- **The fix and why we chose it:** `settings.openDialog(section)` records the section to show, and the dialog starts there. Spaces opens the Editor section, and every other way in still opens Appearance. One small entry point keeps all callers consistent.

**Bug reports named the wrong macOS version.**
- **The issue:** Report a Bug always filled in "macOS 10.15.7", whatever macOS you ran.
- **Why it happened:** the platform came from the web view's user agent, and WebKit freezes the macOS version there at 10.15.7.
- **The fix and why we chose it:** a small backend command, `os_info`, asks the system itself (`sw_vers` on macOS, `/etc/os-release` on Linux, just "Windows" on Windows). If it fails, the link falls back to the family name from the user agent, without the frozen version. A wrong version is worse than none.

## Tests

- `src-tauri/src/memory.rs`: `labels_web_kit_helpers` checks the role names; `measures_the_current_process` (macOS only) checks that our pid comes first and has memory.
- `src/lib/editor/languageName.test.ts`: language names for common files, `Dockerfile` and unknown extensions.
- `src/lib/update/releases.test.ts`: the pre-filled bug link, `osLabel` and the user agent fallback.
- `src-tauri/src/commands/config.rs`: `reads_the_macos_product_version`, `reads_the_linux_distribution`.

`contextRepo` has no unit test; if it grows, move it into a pure function next to the component and test it.

## Keeping this page in sync

- Update this page when `StatusBar.svelte`, `memory.rs` or the issue link helpers change.
- Update [Status Bar and Help](../usage/Status-Bar-and-Help.md) for new items or clicks.
- Retake `status-bar.png`, `help-menu.png` and `settings-about.png` when they change.
- Related: [How Updates Work](How-Updates-Work.md), [How Workspaces Work](How-Workspaces-Work.md).
