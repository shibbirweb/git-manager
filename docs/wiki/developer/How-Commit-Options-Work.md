# How commit options work

The commit box has two controls next to the Commit button: an arrow with **Commit & Push**, **Commit & Sync** and **Commit (Amend)**, and a gear with JetBrains' **Commit Options** (sign-off, author, GPG signing, skip hooks). This chapter shows how both reach `git commit`. The user side is in [Commit Options](../usage/Commit-Options.md).

## Why we need it

People who come from JetBrains IDEs expect the commit dialog's options, and some projects require them: a `Signed-off-by` trailer for the Developer Certificate of Origin, signed commits on protected branches, or committing a patch in its author's name. "Commit and push" is the most common next step, so VS Code's dropdown saves a trip to the menu. Before, the only way to get these was the terminal.

## How it works

### Where each option lives

`commitOptions.svelte.ts` holds the state and splits it on purpose:

- **Sign-off** and **GPG sign** are preferences in `settings.json` (`commitSignOff`, default `false`; `commitGpgSign`, default `"default"`). They describe how you sign your work everywhere, so they persist and also show in Settings > Git.
- **Author** and **Skip hooks** are session state per repository (`session[repoRoot]`). They are one-off choices; forgetting them at quit means you never commit under someone else's name days later.

`commitOptions.for(repoRoot)` merges both into a `CommitOptions` object. `CommitOptionsPopover.svelte` edits it and shows a badge with `changedOptionCount` and a tooltip from `commitOptionsTooltip`, both built from the git arguments the options add.

### From options to git arguments

Every commit path asks `commitOptions.request(repoRoot)` for what to send: `commitRepo` in `views/changes/repoActions.ts` (the Commit button, its arrow, the row's check mark and the **...** Commit items) and `commitCurrentFile` in `views/git/gitMenuActions.ts` (Git > Current File > Commit File...).

```mermaid
sequenceDiagram
  participant UI as Commit box or row
  participant Opt as commitOptions.request
  participant Api as api.ts
  participant Rs as commands/status.rs
  participant CO as commit_options.rs
  participant Git as git CLI
  UI->>Opt: request(repoRoot)
  Opt->>Opt: validateAuthor, empty author becomes null
  Opt-->>UI: CommitOptions, or null with a notice
  UI->>Api: commit / commitAll / commitFiles(..., options)
  Api->>Rs: invoke with options
  Rs->>CO: options.args()
  CO->>CO: author_error again, build arguments
  CO-->>Rs: --signoff, --author=..., -S or --no-gpg-sign, --no-verify
  Rs->>Git: commit [args] [--all] [--amend] -F -
```

`commitOptionArgs` in `commitOptions.ts` mirrors `CommitOptions::args()` in Rust, so the tooltip shows exactly what git will get. GPG has three states: `default` adds nothing (git's `commit.gpgSign` decides), `sign` adds `-S`, `noSign` adds `--no-gpg-sign`. The author goes as one argument, `--author=Name <email>`, so its text can never be read as another option.

### The Commit dropdown

`commitDropdownItems` and `commitChoiceSpec` in `repoMenu.ts` are pure. Each choice maps to `{ amend, followUp }`:

| Choice | Amend | Follow-up |
| --- | --- | --- |
| Commit | the Amend checkbox | none |
| Commit & Push | no | `push(false, repoRoot)` |
| Commit & Sync | no | `syncRepo(repoRoot)` |
| Commit (Amend) | yes | none |

`commitRepo` runs the follow-up only after the commit succeeded, so a refused commit (a failing hook, a bad author) never pushes. Push and Sync are disabled while the Amend checkbox is on, because pushing a rewritten commit needs a force push, and without a branch.

## Where the code lives

| File | What it does |
| --- | --- |
| `src/lib/views/changes/commitOptions.ts` | Pure: GPG choices, `validateAuthor`, `commitRequest`, `commitOptionArgs`, badge and tooltip |
| `src/lib/views/changes/commitOptions.svelte.ts` | The store: settings plus per-repository session options, `request` |
| `src/lib/views/changes/CommitOptionsPopover.svelte` | The gear and its panel |
| `src/lib/views/changes/CommitBox.svelte` | The arrow and `runChoice` |
| `src/lib/views/changes/repoMenu.ts` | `commitDropdownItems`, `commitChoiceSpec` |
| `src/lib/views/changes/repoActions.ts` | `commitRepo` and its follow-up |
| `src-tauri/src/commands/commit_options.rs` | `CommitOptions`, `GpgSign`, `author_error`, `args` |
| `src-tauri/src/commands/status.rs` | `run_commit` and `run_commit_files` add the arguments |
| `src/lib/stores/settingsData.ts` | `commitSignOff` and `commitGpgSign` defaults and validation |

## Design decisions

**Validate the author twice.** The UI checks it as you type, to show the reason. Rust checks again because it builds the command line; a value that starts with `-` or lacks `<email>` is refused there no matter what the UI sent.

**Options are arguments, not config.** We never write `user.name`, `commit.gpgSign` or hooks settings. Arguments affect one commit and leave the user's git setup alone.

**Default means "do what git does".** The GPG default adds nothing, so a user who already signs through `commit.gpgSign` sees the same behavior as in the terminal.

**The dropdown reuses Sync.** Commit & Sync calls the same `syncRepo` as the Sync button, so pull conflicts stop it in the same way. See [How Repository Actions Work](How-Repository-Actions-Work.md).

## Tests

- `src/lib/views/changes/commitOptions.test.ts`: arguments per option, a blank author is left out, author rules match the backend.
- `src/lib/views/changes/repoMenu.test.ts`: the "commit dropdown" cases, choices to amend and follow-up, and what is disabled.
- `src-tauri/src/commands/commit_options.rs`: `maps_each_option_to_its_argument`, `refuses_a_malformed_author`.
- `src-tauri/src/commands/status.rs`: `commit_options_sign_off_set_the_author_and_skip_hooks` commits on a real repository and checks the trailer, the author and that a failing hook was skipped.

## Keeping this page in sync

- A new option needs the same argument in `commitOptionArgs` and `CommitOptions::args()`, a test on both sides, and a line in [Commit Options](../usage/Commit-Options.md).
- Moving an option between settings and session state changes [Settings](../usage/Settings.md) too.
- Retake `commit-options.png` and `commit-dropdown.png` when the gear, its panel or the arrow look different.

## Bugs we fixed

None yet.
