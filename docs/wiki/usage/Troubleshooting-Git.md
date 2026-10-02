# Troubleshooting Git

Problems with git itself, and how to fix them: git not found, hooks that fail, signing in to a server, and the errors git reports. Git Manager runs your own `git` for every change, so most fixes are the same as in the Terminal. Problems with the app are on [Troubleshooting](Troubleshooting.md).

## "Could not start git"

Git Manager runs your own `git` for every change. It looks in `/opt/homebrew/bin`, `/usr/local/bin` and `/usr/bin`, then in your PATH. If git is missing, you may still see your changes, but committing, pushing and similar fail with a note such as **Commit failed** and "Could not start git" followed by the command.

Install git, for example with `xcode-select --install` (Apple's command line tools) or `brew install git`, then try again.

## Hooks fail with "command not found"

PATH is the list of folders where programs are looked up. Apps started from the Dock get a very short PATH, so tools like `node`, `npx` or `husky` used by hooks go missing. Git Manager asks your login shell for the real PATH the first time it runs git. A login shell is your shell started the way it is when you log in, reading your profile files.

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
- **Push rejected** because the server has newer commits: pull first. After a rebase or amend, use **Git > Force Push...**, or tick **Force push (--force-with-lease)** in **Git > Push...**. See [Remotes](Remotes.md).
- **"Cannot push a detached HEAD"**: create a branch first.
- **"This repository has no remote to push to"**: add one in **Git > Manage Remotes...**, or with `git remote add origin <url>`.
- **"No local changes to stash"**: there is nothing to put aside. If you only have new files, tick **Include untracked files**.

## A commit from blame is not found

"Commit is not in the loaded history" means the Log could not find that commit in the history it shows. Turn on **All branches** in the Log toolbar and try again. See [History and Log](History-and-Log.md).

## Related

- [Troubleshooting](Troubleshooting.md)
- [Remotes](Remotes.md)
- [Git Menu](Git-Menu.md)
- [Changes and Commits](Changes-and-Commits.md)
