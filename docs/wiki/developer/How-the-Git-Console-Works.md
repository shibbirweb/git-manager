# How the Git Console Works

The Git Console lists the git commands the app ran, with their arguments, duration, exit code and the start of their output. It is a bottom panel tab, behind the **Git Console** switch in Settings > Git, which is off by default. For the user side, see [Git Console](../usage/Git-Console.md).

## Why we need it

Git Manager runs every write through the git CLI (see [Architecture](Architecture.md)). When a push or rebase does something unexpected, a toast shows only the error. The console shows the whole command and git's output, so it can be repeated in a terminal or pasted into a bug report.

## How it works

Every runner in `src-tauri/src/git/cli.rs` (and the cancellable runner in `git/cancel.rs`, used by Clone) calls `git_console::record(repo_path, args)` before it spawns git. That returns a `CommandRecord`. When git exits, the runner calls `record.finish(exit_code, stdout, stderr)`; when git cannot start, `record.fail(error)`. If the record is dropped without either (an early return), its `Drop` marks the entry failed with "git did not finish", so no entry stays "running" forever.

```mermaid
sequenceDiagram
    participant CLI as git/cli.rs
    participant GC as git_console.rs
    participant EV as "git-command" event
    participant View as GitConsoleView.svelte
    CLI->>GC: record(repo, args)
    alt console is off
        GC-->>CLI: record with no id, nothing stored
    else console is on
        GC->>GC: redact args, push running entry, evict oldest
        GC->>EV: emit (only after the first git_console_entries)
    end
    CLI->>CLI: run git
    CLI->>GC: finish(exit code, stdout, stderr)
    GC->>GC: keep first 16 KB of each, redact, update budget
    GC->>EV: emit finished entry
    EV->>View: upsertEntry
```

### The buffer

`GitConsole` holds a `VecDeque<GitCommandEntry>` behind a mutex, an `enabled` flag and a `OnceLock` emitter. There is one global console (`git_console::global()`), and `AppState.git_console` points at it. Limits are constants: `MAX_ENTRIES` 500, `MAX_OUTPUT_BYTES` 16 KB per stream, `MAX_TOTAL_OUTPUT_BYTES` 4 MB for all entries. `evict` drops the oldest entries until both the count and the byte budget fit. A cut never splits a UTF-8 character, and the entry says which stream was cut.

### Redaction

Arguments go through `redact_args` and output through `redact_text` before they are stored. They mask the password in `scheme://user:password@host`, a token used as the URL user name, the value of any `key=value` whose key contains `extraheader`, `password`, `passwd`, `token`, `secret`, `authorization` or `cookie`, the word after `Bearer` or `Basic`, and tokens starting with `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` or `glpat-`. The GitHub sign-in runs `gh auth token` with its own `Command`, outside `cli.rs`, so that token is never recorded (see [How GitHub Works](How-GitHub-Works.md)).

### Commands and events

| Command | What it does |
| --- | --- |
| `git_console_entries` | Every entry, oldest first. The first call also sets the emitter, so "git-command" events start only once someone opened the console. |
| `git_console_clear` | Empties the buffer. |
| `git_console_set_enabled` | The setting. Off drops every entry. |

The "git-command" event carries one `GitCommandEntry`, once when a command starts and once when it ends. `api.onGitCommand` listens to it.

### The view

`GitConsoleView.svelte` subscribes to the event first, then loads the list and merges events that arrived meanwhile (`mergeEntries`). Each later event goes through `upsertEntry`, which never lets a late "started" event undo a finish. The list is virtualized: `listLayout` computes row tops (24 px rows, open output capped at 14 lines) and `visibleRange` renders the rows in view plus 8 on each side. It follows new entries unless the user scrolled up. Entries are `$state.raw` arrays, replaced, not mutated.

## The switch and memory

The console is off by default, and off costs close to nothing. Most people never open it, and quietly recording every git command would make the app bigger for everyone.

```mermaid
flowchart TD
    Load["settings loaded"] --> Eff["App.svelte effect"]
    Eff -->|"gitConsole false"| Off["git_console_set_enabled(false)"]
    Eff -->|"gitConsole true"| On["git_console_set_enabled(true)"]
    Off --> Free["buffer replaced by a new VecDeque: memory given back"]
    Off --> Hide["tab, View > Git Console and Git > Show Git Console hidden"]
    Off --> NoChunk["GitConsoleView chunk never imported"]
    On --> Rec["record() stores entries"]
```

- **Rust records nothing.** The global console starts disabled before settings load. `start` checks the flag under the buffer lock and returns `None`, so a command that starts while the switch flips never stays behind. With no id, `finish` does nothing: no strings are copied or kept.
- **Turning it off frees memory.** `clear` assigns a new `VecDeque` instead of calling `clear()`, which would keep the capacity of up to 500 entries.
- **No UI code is loaded.** `TerminalPanel.svelte` loads `GitConsoleView.svelte` with a dynamic `import()`, only when the tab shows and the setting is on. The tab itself is filtered out while off. `terminalStore.showTab("gitConsole")` refuses while off, and `closeGitConsole()` leaves the tab when the switch turns off.
- **No events before use.** The emitter is set on the first `git_console_entries`, so until the console is opened, nothing crosses the IPC bridge. Once set, it stays for the session (a `OnceLock`); an event with no listener is cheap.
- **Menus follow.** `menuState.ts` gives `view.gitConsole` and `git.showConsole` `visible: false` while off.

When on, the worst case is bounded: 500 entries and 4 MB of output, plus the arguments.

## Where the code lives

| File | What it does |
| --- | --- |
| `src-tauri/src/git_console.rs` | `GitConsole`, `CommandRecord`, `record`, limits and redaction |
| `src-tauri/src/commands/console.rs` | The three commands and the "git-command" emitter |
| `src-tauri/src/git/cli.rs`, `git/cancel.rs` | Call `record` around every git process |
| `src/lib/console/GitConsoleView.svelte` | The tab: toolbar, filter, virtualized list, context menu |
| `src/lib/console/consoleModel.ts` | Pure list logic: merge, filter, quoting, layout |
| `src/lib/terminal/TerminalPanel.svelte`, `terminalStore.svelte.ts` | The panel tab and `showTab`, `toggleTab`, `closeGitConsole` |
| `src/lib/App.svelte` | Sends the setting to Rust once settings are loaded |
| `src/lib/stores/settingsData.ts` | `gitConsole`, default `false` |
| `src/lib/views/SettingsDialog.svelte` | The switch and Show Git Console button |
| `src-tauri/src/mcp/tools/git_read.rs` | The `git_console_entries` MCP tool, which says when the console is off |

## Design decisions

**Record in `cli.rs`, not per command.** Every git process passes through a few runners, so one call there covers every feature, including new ones. git2 reads are not git commands and are left out on purpose.

**Mask before storing.** Redacting on display would leave secrets in memory and in MCP answers. Masking at record time means nothing secret is ever kept.

**A record that fails on drop.** Early returns with `?` are common in the runners. The `Drop` guard keeps the list honest without touching each return.

## Tests

- `src-tauri/src/git_console.rs`: redaction of URLs, config values, headers and token formats; the 500 entry cap; nothing recorded while off and the list dropped; the per-stream and total output caps; a cut never splits a character; entries go from running to finished and are announced; real git commands are recorded and a dropped record is marked failed.
- `src/lib/console/consoleModel.test.ts`: `upsertEntry`, `mergeEntries`, quoting, durations, the filter, output blocks and the virtual layout.
- `src/lib/stores/settingsData.test.ts`: `gitConsole` defaults to false and only accepts a boolean.
- `src/lib/menu/menuState.test.ts`: the View item is hidden while off.

## Keeping this page in sync

- Update this page when `git_console.rs`, `commands/console.rs` or the console view change, and when a new git runner is added to `cli.rs` (it must call `record`).
- Update [Git Console](../usage/Git-Console.md) for any change to the toolbar, the menu or the limits, and retake `git-console.png` and `git-console-setting.png`.
- Commands and the event are listed in [Commands and Events](Commands-and-Events.md); the switch in [How Settings Work](How-Settings-Work.md).

## Bugs we fixed

None yet.
