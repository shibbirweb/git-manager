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
