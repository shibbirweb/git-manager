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
- GM-63 the branch pill's menu (Header.svelte branchMenu):
  - Built: bridge `get_refs` and `checkout_branch` (branches.rs, shaped like src-tauri's branch.rs, tested in
    tests/writes.rs). The branch pill reads the branches when pressed (no polling) and opens New Branch..., a
    separator and the local branches, the current one as "main (current)" and disabled; a branch runs Checkout as
    repoStore.run does ("Switched to fix/tax-rates", or "Checkout failed" with git's message while merging, both
    seen in the app). Rows the native app cannot run yet (New Branch, New Window, workspace files, Close Folder)
    now say so in a toast. Menu rows are accessible buttons, as the page's menuitems are. The pill shows "HEAD
    detached at <id>" or "No branch" as branchLabel does. gm-measure `--screen branchmenu`.
  - Rules found: the page closes its menu when another app takes the focus too (checked by activating Finder), so a
    run where focus moved is spoiled; gm-measure now warns when another app was in front at the screenshot.
  - Pixel diff below the title bar (HDR off): branchmenu 99.39 to 99.42% light, 99.24% dark (shadow banding as
    GM-62); foldermenu 99.47 and repomenu dark 99.34 after the change.
  - Memory with the menu open: current 147 to 157 MB, native 49 MB.
- GM-64 the clean repositories' list (CleanRepoList.svelte):
  - Built: after the sections, "No Changes" with its count folds the list (by itself past three, NativeCore
    WorkspaceRules.cleanListCollapsed, tested); a 24-point row per clean repository with its icon, name, path,
    operation, the accent bar when active, Set as active repository under the mouse, and the row actions without
    Commit (RepoActions showCommit). gm-measure `--screen cleanrepos`: acme and design-system with payments-api
    (its merge too) and design-system made clean in the throwaway copy, design-system active. demo/extras would stop
    the current app with its Git LFS dialog (media-site), so it is not used.
  - Rules found:
    - The list's 6-point top margin collapses with the last group's 4-point bottom margin: 2 more points after a
      section, not 6.
    - With no markers the branch button is 23 points wide, not 22 (12 + 8 + the empty name track's 2-point gap):
      measured from the icon's place; the reason is not known.
    - gm-measure finds the page's sizes through Accessibility too (AXPosition and AXSize of each button).
  - Pixel diff below the title bar (HDR off): cleanrepos 99.58% light, 99.57% dark; workspace 99.52 and Changes
    99.74 kept their floors.
  - Memory: current 128 to 130 MB, native 40 MB.
  - Not built: the rows' right-click menu (the "..." items, Set as Active Repository, Copy Repository Path).
- GM-65 a folder without any repository (ChangesView.svelte .no-repo, Header.svelte .no-repo, EmptyMain.svelte):
  - Built: AppModel.showNoRepository (no status read, nothing active, the Files panel lists the folder) instead of
    the status read's error; Changes shows NoRepoPlaceholder (circle, "No git repository", the hint wrapped at the
    panel's width, Initialize Repository and Scan Again) with no commit box or layout button and Refresh All; the
    header says "No git repository" where the branch pill goes; the welcome screen dims Show the Log; the
    breadcrumb shows the folder. Initialize Repository runs the bridge's new `init_repository` (src-tauri's
    workspace::init, tested), scans again and makes the new repository active (checked in the app: notes became a
    repository with its 3 files). gm-measure `--screen norepo` (demo/acme/notes); AppLauncher counts an open
    workspace with no repository as ready in both apps.
  - Rules found: WholePointCenter measures its content at unlimited width, so text that should wrap needs the
    column's width first (NoRepoPlaceholder.centered).
  - Pixel diff below the title bar (HDR off): norepo 99.76% light, 99.76% dark; Changes kept 99.74.
  - Memory: current 130 MB, native 33 MB.
- GM-66 the welcome screen's Projects page with no recent projects (Welcome.svelte):
  - Built: WelcomeWindow (the 240-point sidebar: brand with the version, Projects, Customize and Learn, Star on
    GitHub, Report a Bug, Request a Feature, the gear) and WelcomeProjects (the big logo, "Welcome to Git Manager",
    the hint, the Open, Clone Repository and Open Workspace tiles); ContentView shows it when nothing is open, not
    while start-up folders are opening. Open picks a folder; Customize, Learn, Clone and Open Workspace say they are
    not built. NativeCore GitHubLinks builds the GitHub links as releases.ts does (tested). build-app.sh takes the
    bundle version from src-tauri/Cargo.toml. gm-measure `--screen welcome` and parity scenarios without a folder
    start both apps with no folder (AppLauncher waits for "no workspace"); the `welcome` scenario now runs.
  - Rules found:
    - The hint's line-height 1.6 (20.8 points) puts its lines 20 points apart on the page.
    - --selected in the sidebar is an sRGB layer fill (LayerFill), as in the Settings dialog; the pre-blended solid
      came out one step off.
    - WebKit shows no hover until the pointer moves over the page; SwiftUI's onHover lit the Open tile under the
      pointer resting on the built-in screen. Every hover now goes through pageHover (Components/PageHover.swift):
      nothing hovers until the pointer has left where it rested when the window opened.
    - The earlier foldermenu dark score (99.34) came from a run where no menu had opened; with the menu open it is
      99.17 (repomenu dark 99.27 and branchmenu dark 99.24 were checked with their menus open).
  - Pixel diff below the title bar (HDR off): welcome 99.87% light, 99.85% dark (parity: 99.87 / 99.85).
    Changes 99.74, Log 99.52, cleanrepos 99.58, workspace dark 99.34 kept their floors.
  - Memory: current 115 to 120 MB, native 25 to 28 MB.
- GM-67 the welcome screen's recent projects (Welcome.svelte .toolbar and .projects, welcomeModel.ts,
  recentEntries.ts):
  - Built: NativeCore RecentProjects (state.json's recent lists, the entries in the current app's order) and
    WelcomeList (initials, badge colors with the same string hash, search, keys), tested against values from the
    TypeScript run with Bun. RecentProjectsStore keeps them in ~/.gitmanager-native/state.json (other keys kept, an
    unreadable file never written) and records every opened workspace. The page shows the focused search field,
    Open, Clone and "...", and a row per project (gradient initials badge, name, paths cut with WebKit's ellipsis,
    the selected row's "..." menu: Open, Reveal in Finder, Copy Path, Remove from Recent Projects). Arrows, Home,
    End, Enter, Escape and Delete work as in the page. Opening a row was checked in the app. gm-measure
    `--screen welcomerecent` seeds both homes' state.json (AppLauncher `state:`), with lastSession: [] so the
    current app does not reopen the newest folder.
  - Rules found: a .btn's 1-point border is outside its padding (17 points a side, not 16); the search field's
    icon is 12 points inside its border.
  - Pixel diff below the title bar (HDR off): welcomerecent 99.64% light, 99.22% dark (the field's 25% ring and
    the badge gradients are one level off in dark; the other pre-blend made light worse).
  - Memory: current 179 MB, native 29 MB (dark run).
  - Not built: the right-click menu on a row, Open in New Window, workspace files, the state.json error notice.
- GM-68 Close Folder (repoStore.closeWorkspace):
  - Built: AppModel.closeWorkspace asks first when tabs have unsaved edits (the page's "Unsaved Changes" wording,
    Discard and Cancel, as a native alert), then forgets the workspace, the active repository, the diff, the tabs,
    the Log and the Files panel; the window shows the welcome screen, the folder at the top of the recent projects.
    The folder menu's Close Folder / Close Workspace runs it. AccessibilityPress also presses the page's menu rows
    (role="menuitem" is AXMenuItem). gm-measure `--screen closefolder` opens storefront, presses the folder pill
    and Close Folder, and captures the welcome list in both apps.
  - Pixel diff below the title bar (HDR off): closefolder 99.82% light, 99.48% dark; foldermenu kept 99.47.
  - Memory after closing: current 190 MB (it keeps what the workspace loaded), native 36 MB.
