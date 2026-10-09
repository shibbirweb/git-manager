# SwiftUI experiment: status notes, part 3

Continues [swiftui-status-2.md](swiftui-status-2.md). Newest last.

- GM-60 a folder with several repositories (repo.svelte.ts openFolders, ChangesView.svelte, RepoSection.svelte):
  - Built: the bridge's `open_workspace` and `discover_repositories` (commands/workspaces.rs, tests/workspace.rs).
    WorkspaceModel holds the folder, its repositories and each one's status; the active one is still AppModel's
    repository, so every screen built for one repository works unchanged. NativeCore WorkspaceRules (tested): the
    active repository (remembered, else a workspace folder, else the first), when the header shows the repository
    pill, the commit target and its choices, the picker's labels, folder-relative paths, the operation badge.
    With several repositories: the header's "/ payments-api 2" pill; Changes with "Refresh All", a section per
    repository with changes (chevron, semibold name, change count, Merging badge, the 3-point accent bar of the
    active one, the row actions wrapping to a second line when the narrowest widths do not fit) and its groups 12
    points in; the activity bar's total; the commit box's "Commit to [payments-api, 4] on ..." row; the breadcrumb
    "acme > payments-api"; the Files panel on the folder with repository rows (accent icon, semibold name, branch).
    A click in another repository's section makes it active first. Control: `get_state` has `workspace`; actions
    `toggle_repo` and `set_active_repo`.
  - Measuring on the built-in display: gm-measure puts both windows there (MeasureScreen), so the user can work on
    another display. The current app opens from a saved session in state.json with bounds on that screen (a folder
    on its command line skips the session); the native app takes `-windowFrame`. Display checks and capture scale
    read that screen, not NSScreen.main. `git mergetool` runs of the current app cannot be placed, but landed there.
  - Rules found:
    - The commit target row is a flex row that overflows: the free space comes from the items' unclamped flex base
      sizes (the select's natural width, about 183 points), shared in proportion to them, and only then is the
      select held to its max-width of 70%: 135.5 points, where clamping first gives 133 (NativeCore FlexShrink).
    - WebKit's select: text 9 points in and half a point higher, clipped 21 points before the right edge; its arrows
      are two 6.5 x 3 point chevrons, 1.2-point strokes, 10.75 points from the right; its corners come out at about a
      5-point radius although border-radius is 6px. text-overflow keeps the space before the ellipsis ("on ...").
    - color-mix(in srgb, X 18%, transparent) as a background is an rgba() fill: 8-bit premultiplied, half precision
      (Theme.fill); Theme.over was a step off in dark.
    - A conflicted repository's name in the Files panel is weight 500: .row.conflict comes after .row.repo.
    - Text that other items follow must be ExactText (the repository name, the breadcrumb crumbs): SwiftUI rounds a
      Text's width up to the pixel and moves everything after it.
    - The Changes list overflows here, so WebKit composites it in a layer of its own; its text then blends a step
      differently in dark (the same as Settings and Search), which keeps dark about 0.17 below light.
  - Pixel diff below the title bar (HDR off): workspace 99.5% light, 99.34% dark; parity scenario `workspace` 99.51 /
    99.33. The rest is the status bar's memory readout, sub-pixel glyph places in the header pills, and dark text.
  - Memory (parity, acme open, light): current 146 MB, native 43 MB.
  - Every other screen kept its floor (noise 0.01): Changes 99.74 / 99.74, staged 99.74 / 99.73, diff 99.66 /
    99.67, every line 99.65 / 99.66, file 99.63 / 99.64, edit 99.49 / 99.48, fold 99.52 / 99.51, blame 99.62 / 99.6,
    Log 99.52 / 99.39, Settings 99.5 / 99.1, Monokai Charcoal (Changes) 99.49, terminal 99.5 / 99.38, quickopen
    99.64 / 99.62, palette 99.5 / 99.29, search 99.6 / 99.13, merge 99.66 / 99.59, report.ts 99.25, conflicts 99.2 /
    99.15. Smoke: get_state and Quick Open now give real paths (/private/var...), as the current app does; a folder
    around a repository opens it, a folder without git has no repository.
  - Parity results are pages now (results-1.json, results-2.json, 12 scenarios each): one file passed 300 lines.
  - Not built: the folder menu and the repository switcher (the pills open nothing), Add and Remove Folder,
    workspace files, Scan for Repositories, Close Folder, the clean repositories' list, the kind badges (submodule,
    worktree) and relative paths in section headers, remembering the active repository, several windows, the
    "No git repository" placeholder (a folder without git shows the read error).
- GM-61 a workspace of several folders (repo.svelte.ts openFolders, FileExplorer.svelte multiRoot, navBarModel.ts):
  - Built: the native app opens several folders as one workspace (`-folders '("/a", "/b")'`, control `open_folder`
    with `folderPaths`); their repositories join in one list and a repository that is a workspace folder becomes
    active (design-system next to acme). The Files panel works on absolute paths: with several folders each is a
    top-level row in 11-point bold capitals (the repository icon, branch and tone dot as other rows), its contents
    one level in; the heading shows the workspace name. The breadcrumb starts with the workspace crumb (app-window
    icon) and goes through the folder to the active repository (NativeCore FolderPaths, tested). The activity bar's
    badge is red while any repository has a conflict. gm-measure `--screen folders`; the parity scenario
    `workspace` now opens acme and design-system (run spec `extraFolders`).
  - Rules found:
    - The Files heading's buttons are flex items: a long title shrinks with them until they reach their 24-point
      min-width, then alone (FlexShrink now freezes items at their min-width and shares the rest again); WebKit cuts
      the title keeping the hyphen ("ACME, DESIGN-...", letter-spacing counted).
    - A select is as wide as its widest option, not the shown one ("design-system" in a picker sized for
      "payments-api, 4 staged").
    - CSS order decides the folder row's weight: .row.repo 600, .row.folder-root 700, .row.conflict 500 last, so a
      conflicted workspace folder is 500.
    - 11-point text in the Files rows (branches, folder roots) sits half a point lower than SwiftUI sets it.
    - A Spacer in an HStack also takes the stack's spacing before it: the file rows lost 8 points and cut
      "src/components"; the name now takes the free width itself and stays whole when the exact widths fit.
    - macOS parses a `-key value` launch argument as a property list: JSON arrays are dropped, `("/a", "/b")` works.
  - Pixel diff below the title bar (HDR off): folders 99.53% light, 99.34% dark; workspace (one folder) 99.52 /
    99.34; parity scenario `workspace` (two folders) 99.54 / 99.31.
  - Memory (parity, acme and design-system, light): current 141 MB, native 47 MB.
  - Every other screen kept its floor (noise 0.01): Changes 99.74 / 99.73, staged 99.74 / 99.73, diff 99.66 /
    99.67, every line 99.65 / 99.65, file 99.64 / 99.63, edit 99.49 / 99.49, fold 99.52 / 99.51, blame 99.62 / 99.6,
    Log 99.52 / 99.38, Settings 99.49 / 99.09, Monokai Charcoal (Changes) 99.48, terminal 99.5 / 99.37, quickopen
    99.63 / 99.63, palette 99.5 / 99.29, search 99.6 / 99.16, merge 99.66 / 99.59, report.ts 99.25, conflicts 99.2 /
    99.15.
  - Bug found on the way: the first status's tones were worked out before the Files panel knew its folders, so a
    single repository's folders had no tone (conflicts list 99.07%); the panel keeps the last changes and works the
    tones out again when its folders are set.
  - Not measurable yet: the folder menu and the repository switcher are the page's own menus, opened at the pointer;
    the current app has no control tool to open them, and clicks posted to its process are dropped without the
    Accessibility permission for the terminal.
  - Not built: those menus, Add and Remove Folder, workspace files, Scan for Repositories, Close Folder, the clean
    repositories' list, the "No git repository" placeholder, several windows. The Changes scrollbar's length was
    stale once at start (the last section arrived after the list was measured); it did not come back in later runs.
- GM-62 the header's folder menu and repository switcher (Header.svelte workspaceMenu and repoPickerMenu,
  ContextMenuHost.svelte, menuNav.ts):
  - Built: a native context menu (ContextMenuCenter, ContextMenuView: PopupFrame's panel, ring and shadow, rows of
    5 by 10 points around a 16-point line, hints in --text-faint, submenus beside their row, separators), with the
    page's hover, click, type-ahead and arrow, Return, Escape and Tab keys; a press outside or the window losing focus
    closes it. The folder pill opens New Window, Open Folder..., Add Folder to Workspace..., a Remove row per folder
    with two or more, Scan for Repositories and Close Folder or Close Workspace; the repository pill lists the
    repositories (a check before the active one, path and change count as hint) and switches. NativeCore MenuNav
    ports menuNav.ts (tested). gm-measure `--screen foldermenu` and `--screen repomenu`.
  - Rules found:
    - Clicks posted to an app's process (CGEvent postToPid) never reach AppKit's windows, even with the app in front
      and the window fields set; posted keys do. Pressing the button through Accessibility (AXPress) works in both
      apps and leaves the pointer alone (MeasureKit AccessibilityPress; WebKit builds the page's tree after
      AXManualAccessibility). WebKit names a button by AXTitle, SwiftUI by AXDescription.
    - WebKit runs an AXPress as a click on the innermost element at the button's center (the pill's name span),
      at that element's center cut to whole points: the menu opens at (126, 20) for acme, (250, 20) for payments-api.
    - HTML drops the leading spaces of "   storefront" (white-space: nowrap collapses them).
    - The shadow keeps a one-level banding against the page (it paints the menu's shadow into its own layer, the
      native app composites a layer): a float layer is dithered by macOS, truncated alpha is worse (98.6%).
  - Pixel diff below the title bar (HDR off): foldermenu 99.48% light, 99.34% dark; repomenu 99.48 / 99.27. The
    parity scenario `workspace` stays without the menu: two folders' Remove rows carry the demo's long temp paths,
    and that wide menu's shadow drops dark to 98.66%. workspace, folders and Changes kept their floors.
  - Memory with a menu open (5 s samples): current 145 to 166 MB, native 47 to 51 MB (44 MB without a menu).
  - Measuring brings each app to the front, so typing on another screen during a run lands in it (a run had "pdate"
    in the native commit box and its menu closed); such a run is thrown away.
  - Not built: recent folders in the folder menu, New Window, Open Folder in New Window, workspace files and Close
    Folder (their rows do nothing); the branch pill's menu.
