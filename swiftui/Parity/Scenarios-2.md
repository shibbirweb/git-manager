# Parity scenarios (continued)

## conflicts: Conflicts dialog (native app cannot show it yet)

Folder: demo `acme/payments-api`

1. Start the app on demo/acme/payments-api, which is stopped in a merge with conflicts.
2. Click Resolve... on the Conflicts group in Changes.

- Resolving conflicts (`conflicts`, missing): The operation banner, the Conflicts group and dialog, Abort and
  Continue.

## merge-tool: Merge tool (native app cannot show it yet)

Folder: demo `acme/payments-api`

1. Start the app on demo/acme/payments-api.
2. Click the first file of the Conflicts group: the three pane merge tool.

- Merge tool (`merge-tool`, missing): Three panes, taking changes from either side, the result.

## mergetool-mode: git mergetool window (native app cannot show it yet)

Folder: demo `acme/payments-api`

1. Set Git Manager up as git's mergetool (docs/wiki/usage/Git-Mergetool.md).
2. Run git mergetool in demo/acme/payments-api: a merge window opens for the first conflicted file.

- git mergetool mode (`mergetool`, missing): git mergetool opens a merge window per conflicted file.

## blame: Blame (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront and double-click src/cart.ts.
2. Click Blame (the clock button) in the path bar: the blame gutter beside the line numbers.

- Blame (`blame`, missing): The current line note and the blame gutter.

## log: Log (runs in both apps)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Press Shift+Cmd+L (View > Log) and click the merge commit of feature/checkout.

Measured: light 99.46% (191 MB / 52 MB, 2026-10-08), dark 99.33% (190 MB / 52 MB, 2026-10-08).

- History and log (`log`, partial): The commit graph, the commit details and the right-click menu. Native lacks: the
  right-click menu and its actions (new branch, checkout, cherry-pick, revert, rebase, reset, bisect); the filter box
  takes text but is not tested; Load more, the keyboard in the file list and resizing the panes; blame in the commit
  diff, Open in Tab and Open File, the inline layout and binary or LFS previews.

## commit-tab: Commit tab (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Open the Log of demo/acme/storefront.
2. Double-click the merge commit of feature/checkout: it opens in a commit tab.

- Commit tabs (`commit-tabs`, missing): A commit in its own tab with its files and diff.

## branches-sidebar: Branches and Stashes sidebar (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Press Shift+Cmd+E: branches, tags, the stash WIP: free shipping threshold and Worktrees.

- Branches and tags (`branches`, missing): Local and remote branches, tags, and their right-click actions.
- Stashes (`stashes`, missing): The stash in the sidebar; stash, apply, pop and drop.
- Worktrees (`worktrees`, missing): The Worktrees section and the New Worktree dialog.

## branches-popup: Branches popup (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the branch button (main) in the Changes title bar and point at feature/checkout.

- Branches popup (`branches-popup`, missing): The branch list with a submenu of actions per branch.

## remotes: Pull and push menu (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront (one commit ahead of origin).
2. Click the arrow next to Sync in the Changes title bar: Pull, Push, Fetch.

- Remotes (`remotes`, partial): Ahead and behind numbers; fetch, pull and push. Native lacks: only the ahead and
  behind numbers in the header and status bar; fetch, pull and push.

## shelf: Shelf (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Choose Git > Uncommitted Changes > Shelve Changes... and shelve src/cart.ts.
3. Choose Git > Uncommitted Changes > Show Shelf: the Shelf tab of the bottom panel.

- Shelf (`shelf`, missing): The Shelve Changes dialog and the Shelf tab.

## menu-bar: Menu bar and Git menu (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Open each menu of the menu bar (File, Edit, View, Code, Git, Window, Help); compare items, not pixels.

- Git menu (`git-menu`, missing): Every item of the Git menu, grey when it cannot run.
- Menu bar (`menus`, missing): File, Edit, View, Code, Git, Window and Help with their keys. Native lacks: the native
  app has SwiftUI's default menus only.

## git-dialogs: Push dialog (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Choose Git > Push...: the Push dialog with one commit to push.

- Git dialogs (`git-dialogs`, missing): Push, Pull, Update Project, Merge, Rebase, Reset, Rollback, Remotes and Clone.

## interactive-rebase: Interactive rebase (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Open the Log of demo/acme/storefront.
2. Right-click the third commit and choose Interactively Rebase from Here...

- Interactive rebase (`interactive-rebase`, missing): The list of commits to reorder, reword, squash, edit and drop.

## submodules: Submodule changes (native app cannot show it yet)

Folder: demo `extras/shop-app`

1. Start the app on demo/extras/shop-app.
2. Changes shows the submodule themes/acme with new commits and modified content.

- Submodules (`submodules`, missing): The submodule row with new commits and modified content; init, update, add,
  remove.

## git-lfs: Git LFS diff (native app cannot show it yet)

Folder: demo `extras/media-site`

1. Start the app on demo/extras/media-site.
2. Click assets/hero.png under Changes: the LFS tag and both sizes in the diff.

- Git LFS (`git-lfs`, missing): The LFS tag in Changes and the sizes in the diff.

## settings: Settings (runs in both apps)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Press Cmd+, (Git Manager > Settings...) and look at Appearance, then Editor, Git and Automation.

Measured: light 99.42% (213 MB / 46 MB, 2026-10-09), dark 99.03% (213 MB / 46 MB, 2026-10-09).

- Unload hidden tabs (`unload-hidden-tabs`, missing): Settings > Editor > Unload hidden tabs; an unloaded tab opens
  where it was.
- Settings (`settings`, partial): The Settings dialog with its sections. Native lacks: only Theme, the color themes
  and Commit box change anything; the other rows show their values read-only; the Keyboard Shortcuts list, the GitHub
  sign-in, the commit identity and templates, the font previews; Reset to Defaults asks with a plain macOS alert; the
  dialog cannot be dragged.
- MCP server and command line tool (`mcp`, partial): Settings > Automation; git-manager cli status and the MCP tools.
  Native lacks: only get_app_info, app, git_status, get_memory_usage, sample_memory and take_screenshot; no settings:
  the native server always runs.

## settings-search: Search in Settings (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Open Settings (Cmd+,) and type font in the search field.

- Search in Settings (`settings-search`, partial): Matching sections and highlighted matches. Native lacks: keyboard
  shortcuts are not searched; highlights are a tint, not the Custom Highlight API's.

## color-themes: Color theme Monokai Charcoal (runs in both apps)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. In Settings > Editor, pick Monokai Charcoal as the Dark theme; switch to dark mode.

Note: The run sets darkColorTheme in both apps' settings.json; in light mode it shows the default light theme.

Measured: light 99.75% (135 MB / 34 MB, 2026-10-09), dark 99.49% (136 MB / 34 MB, 2026-10-09).

- Color themes (`color-themes`, done): Monokai Charcoal in dark mode: panels, code and diffs in its colors.

## github: GitHub settings (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Open Settings (Cmd+,) and choose GitHub: the sign-in choices.

- GitHub account (`github`, missing): Sign in, Share Project on GitHub, Sync Fork and gists.

## git-console: Git Console (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Turn on Settings > Git > Git Console, then click Refresh in Changes.
2. Choose View > Git Console: the commands the app ran, with their output.

- Git Console (`git-console`, missing): Every git command the app ran, with its output.

## back-forward: Back and Forward (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront; open src/cart.ts at line 30, then docs/checkout.md.
2. Click Go Back in the header: cart.ts at line 30 again.

- Back and Forward (`navigation`, missing): Back and Forward across files, diffs and commits. Native lacks: the
  header's arrows are drawn (disabled) but do nothing.

## terminal: Terminal panel (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click Terminal at the bottom of the left activity bar.

- Integrated terminal (`terminal`, missing): The terminal panel with its header and several terminals.

## scripts: Scripts panel (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the play button in the left activity bar (View > Scripts): the scripts of package.json.

- Scripts tool window (`scripts`, missing): The scripts of package.json with run buttons and the Node version.

## update-dialog: Update available (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Run a build older than the newest release on its channel and wait about 30 seconds.
2. Click Update available in the status bar: the update window.

- Updates and release channels (`updates`, missing): Update available in the status bar and the update window.

## memory-breakdown: Memory breakdown (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the memory readout at the right of the status bar.

- Memory readout and memory log (`memory`, partial): The readout in the status bar and its breakdown. Native lacks:
  the breakdown popup; the memory log and the memory marks in Settings.
- Clear Cache (`clear-cache`, missing): The brush right of the readout: the window blinks and comes back as it was.
  Native lacks: the brush is drawn but does nothing (the native app has no WebKit cache to clear).
