# Parity scenarios (continued)

## commit-options: Commit options (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click the gear next to Commit in the commit box, then the arrow next to Commit.

- Commit options (`commit-options`, missing): Commit & Push, Commit & Sync, sign-off, author, GPG signing, skip hooks.

## diff-inline: Inline diff of src/cart.ts (native app cannot show it yet)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront and click src/cart.ts under Changes.
2. Click Inline in the diff toolbar.

- Inline diffs (`inline-diffs`, missing): Removed lines above the new ones in one column.

## conflicts: Conflicts dialog (runs in both apps)

Folder: demo `acme/payments-api`

1. Start the app on demo/acme/payments-api, which is stopped in a merge with conflicts.
2. Click Resolve... on the Conflicts group in Changes.

Measured: light 99.2% (167 MB / 47 MB, 2026-10-09), dark 99.16% (167 MB / 47 MB, 2026-10-09).

- Resolving conflicts (`conflicts`, partial): The operation banner, the Conflicts group and dialog, Abort and
  Continue. Native lacks: the operation banner, the Conflicts group in Changes and the status bar's conflict count;
  Continue and Abort run nothing yet (the dialog's Continue only closes it); deleted files in the Files panel, Publish
  Branch in the commit box.

## merge-tool: Merge tool (runs in both apps)

Folder: demo `acme/payments-api`

1. Start the app on demo/acme/payments-api.
2. Click the first file of the Conflicts group: the three pane merge tool.

Note: No control tool opens the current app's merge tool over its window, so the run starts both apps as git mergetool
on src/app.ts (MergeToolApp.svelte shows the same MergeEditor.svelte under a 38-point title bar).

Measured: light 99.66% (157 MB / 35 MB, 2026-10-09), dark 99.59% (157 MB / 35 MB, 2026-10-09).

- Merge tool (`merge-tool`, partial): Three panes, taking changes from either side, the result. Native lacks: typing
  in the result pane (it shows the result and takes chunk actions, undo and redo); the find bar, clicking a ruler
  tick, and keeping Ignore whitespace between launches; the current app's merge tool over its window cannot be opened
  from outside, so the scenario runs both; apps as git mergetool, which shows the same editor.

## mergetool-mode: git mergetool window (native app cannot show it yet)

Folder: demo `acme/payments-api`

1. Set Git Manager up as git's mergetool (docs/wiki/usage/Git-Mergetool.md).
2. Run git mergetool in demo/acme/payments-api: a merge window opens for the first conflicted file.

- git mergetool mode (`mergetool`, partial): git mergetool opens a merge window per conflicted file. Native lacks: the
  native app takes the four files as -mergeBase, -mergeLocal, -mergeRemote and -mergeMerged, not the; current app's
  `merge BASE LOCAL REMOTE MERGED` command line, and installs no mergetool settings.

## blame: Blame (runs in both apps)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront and double-click src/cart.ts.
2. Click Blame (the clock button) in the path bar: the blame gutter beside the line numbers.

Measured: light 99.43% (268 MB / 42 MB, 2026-10-09), dark 99.33% (269 MB / 41 MB, 2026-10-09).

- Blame (`blame`, partial): The current line note and the blame gutter. Native lacks: clicking a note or a gutter
  block (the commit in the Log, Option-click copies its hash) and their tooltips; Blame in the diff toolbar.

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

- Branches and tags (`branches`, partial): Local and remote branches, tags, and their right-click actions. Native
  lacks: only the header's branch menu (local branches, switching); the Branches sidebar, remote branches and tags;
  New Branch and every right-click action.
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

- Git dialogs (`git-dialogs`, partial): Push, Pull, Update Project, Merge, Rebase, Reset, Rollback, Remotes and Clone.
  Native lacks: only Clone (from the welcome screen); Push, Pull, Update Project, Merge, Rebase, Reset, Rollback,
  Remotes.

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

## github: GitHub settings (runs in both apps)

Folder: demo `acme/storefront`

1. Open Settings (Cmd+,) and choose GitHub: the sign-in choices.

Measured: light 99.39% (224 MB / 48 MB, 2026-10-09), dark 99.43% (226 MB / 51 MB, 2026-10-09).

- GitHub account (`github`, partial): Sign in, Share Project on GitHub, Sync Fork and gists. Native lacks: Git >
  GitHub: Share Project on GitHub, Sync Fork, Create Gist and the sign-in dialog.

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

## terminal: Terminal panel (runs in both apps)

Folder: demo `acme/storefront`

1. Start the app on demo/acme/storefront.
2. Click Terminal at the bottom of the left activity bar.

Note: gm-measure writes a .zshrc into each app's throwaway HOME: a "$ " prompt, fixed text in the theme's colors and
styles, and the cursor hidden, as a blinking cursor differs by the moment of capture.

Measured: light 99.5% (270 MB / 44 MB, 2026-10-09), dark 99.38% (271 MB / 49 MB, 2026-10-09).

- Integrated terminal (`terminal`, partial): The terminal panel with its header and several terminals. Native lacks:
  one terminal: the shell menu, Split, Move into Editor Area, the terminal list and renaming do nothing; selection,
  find, file links, the scrollbar, dropping files and terminals in editor tabs; Settings, Terminal (font, cursor,
  scrollback) and the Shelf tab's view.
