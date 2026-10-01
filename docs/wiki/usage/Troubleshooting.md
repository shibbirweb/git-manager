# Troubleshooting

Common problems and how to fix them. If yours is not here, use **Report a Bug** in the status bar (see [Status Bar and Help](Status-Bar-and-Help.md)).

## macOS will not open the app

Builds are not signed by Apple yet, so the first launch shows an "unidentified developer" warning.

1. In Applications, right-click (or Control-click) **Git Manager** and choose **Open**.
2. Click **Open** in the warning.

On newer macOS versions this may not offer Open. Then try to open the app once, go to **System Settings, Privacy and Security**, scroll down and click **Open Anyway**. As a last resort, this Terminal command removes the download mark:

```sh
xattr -dr com.apple.quarantine "/Applications/Git Manager.app"
```

You only need to do this once per download.

## "Could not start git"

Git Manager runs your own `git` for every change. It looks in `/opt/homebrew/bin`, `/usr/local/bin` and `/usr/bin`, then in your PATH. If git is missing, you may still see your changes, but committing, pushing and similar fail with a note such as **Commit failed** and "Could not start git" followed by the command.

Install git, for example with `xcode-select --install` (Apple's command line tools) or `brew install git`, then try again.

## Hooks fail with "command not found"

Apps started from the Dock get a very short PATH, so tools like `node`, `npx` or `husky` used by hooks go missing. Git Manager asks your login shell for the real PATH the first time it runs git.

A login shell does not read `~/.zshrc`. If you add tools to your PATH only there (common with nvm), move those lines to `~/.zprofile`, then quit and reopen Git Manager.

## Push, pull or fetch fails to sign in

Git Manager never shows a password prompt, because it cannot answer one. You may see git messages like "terminal prompts disabled" or "could not read Username". Set up sign-in so it works without typing:

- **HTTPS**: use a credential helper, for example `git config --global credential.helper osxkeychain`, then push once in the Terminal so the keychain stores your token. For GitHub, `gh auth login` from the GitHub CLI sets this up for you.
- **SSH**: add your key to the agent and keychain, for example `ssh-add --apple-use-keychain ~/.ssh/id_ed25519`.

Test in the Terminal with `git fetch`. If it works there without asking anything, it works in Git Manager too.

Signed commits have the same catch: a GPG passphrase needs a graphical prompt such as `pinentry-mac`.

## Other git errors

When git refuses something, its own message is shown. A few common ones:

- **Checkout refuses** because your changes would be overwritten: commit or [stash](Stashes.md) them first.
- **Push rejected** because the server has newer commits: pull first. After a rebase or amend, use a force push (Option-click Push). See [Remotes](Remotes.md).
- **"Cannot push a detached HEAD"**: create a branch first.
- **"This repository has no remote to push to"**: add one with `git remote add origin <url>`.
- **"No local changes to stash"**: there is nothing to put aside. If you only have new files, tick **Include untracked files**.

## A repository is missing

The folder scan goes six levels deep and skips folders such as `node_modules`, `vendor`, `build`, `dist`, `target` and `.venv`. It does not follow symbolic links.

- A repository you clone or create in the folder shows up on its own after a moment. If it does not (for example when file watching is unavailable), choose **Scan for Repositories** in the folder menu.
- For a repository deeper down or inside a skipped folder, add it directly with **Add Folder to Workspace...**.

## Changes do not show up

Git Manager watches your folders and refreshes on its own. If you see "File watching is unavailable for" and a folder name, use the refresh buttons in Changes, the Files panel and the Log.

## A file will not open

Files over 4 MB and binary files are not opened in the editor. Folders with more than 5000 entries show only the first 5000 (folders first, then by name) in the Files panel.

## Settings were reset, or are not saved

- **"settings.json could not be read"** at the top of Settings means the file has a mistake, such as a missing comma. Git Manager uses the defaults and does not overwrite your file. Fix it and click **Try Again**, or click **Reset to Defaults**.
- **"state.json could not be read"** means recent folders, the last session and panel sizes could not be loaded. The file is not overwritten. Fix it and click **Try Again**, or click **Reset** in that banner to start a fresh one.
- **"Could not save settings"** usually means `~/.gitmanager` is not writable. Check its permissions.

See [Settings](Settings.md).

## A commit from blame is not found

"Commit is not in the loaded history" means the Log could not find that commit in the history it shows. Turn on **All branches** in the Log toolbar and try again. See [History and Log](History-and-Log.md).

## The update check fails

Automatic checks fail quietly when you are offline. **Check Now** in Settings, Updates shows the reason in a **Could not check for updates** note:

- **"GitHub rate limit reached, try again later"**: GitHub allows 60 requests an hour per network. Wait a while.
- **"GitHub answered 404"**: the releases could not be found, for example because the repository is private or moved. Check the Releases page in your browser.
- **"The update check timed out"**: the network is slow or blocked.

A version you skipped still opens the update window after **Check Now**, marked **You skipped this version.** Click **Stop Skipping** to be told about it again.

See [Updates](Updates.md).

## git mergetool does not open Git Manager

Check the command git uses:

```sh
git config --global --get mergetool.gitmanager.cmd
```

The path must point to `Contents/MacOS/git-manager` inside the app. See [Git Mergetool](Git-Mergetool.md).

## The memory number looks different

When started from a Terminal, macOS counts the app's helper processes differently, so they are matched by start time and the number is approximate.

## Related

- [Getting Started](Getting-Started.md)
- [Remotes](Remotes.md)
- [Settings](Settings.md)
- [Updates](Updates.md)
- [Developer Guide](../developer/Developer-Guide.md)
