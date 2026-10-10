# SwiftUI experiment: status notes, part 4

Continues [swiftui-status-3.md](swiftui-status-3.md). Newest last.

- GM-74 speed, first part (the user saw lag in Search Everywhere and when a diff opens; the native app must be
  faster than the current app wherever speed is measured):
  - Tool: `gm-measure speed` times both apps the same way from the outside. FrameRecorder streams the window at
    120 frames a second (ScreenCaptureKit) and keeps each frame's time and region version; a frame counts as a
    change only when a sampled pixel moves more than 3 levels (a 1-level redraw of the toolbar text had counted as
    "settled"). Cases: search (Shift+Cmd+F, "reserve" typed 30 ms a key over 2000 files: first results after the
    first key, settled after the last), echo (a key to the field on screen), diff (a 4000-line PHP diff asked for
    through each app's control tool: first paint, colors in), scroll (the diff walked down and back: frames a
    second, gaps). Both apps settle 6 s after launch first: a LaunchServices clean-up a few seconds after any launch
    held the Objective-C runtime lock and stalled the native main thread. `--frames` keeps pictures of the changed
    frames. A window that opens off the built-in display is moved there through Accessibility (WindowPlacement).
  - Search: the bridge streams Find in Files (`text_search_start` runs the search on a thread of its own,
    `text_search_poll` hands over the batches since the last poll, waiting up to waitMs for the first; tested).
    The popup starts the search on the keystroke and keeps the previous results until the new ones fill the
    visible rows or end. Popup shadows are cached tiles stretched by Core Animation, built off the main thread and
    prewarmed when Search Everywhere opens (ShadowTiles); the full redraw had taken 30% of the main thread.
  - Diff: the highlighter colors each side up to 150 lines past the first change first (Highlight/entry.ts takes
    upTo and folds; NativeCore SyntaxWindow, tested), then the whole text; diffs skip folds. JavaScriptCore starts
    and the code fonts load in the background a second after launch (each ~35 ms on the first diff before, about
    2.4 MB kept). A two-line diff screen is built off screen once after launch (ViewWarmUp: SwiftUI's first-time
    cost of those views, ~100 ms). The ruler draws one shape per kind of tick, not a view per change (500 in the
    bench). The diff's scroll host places its canvas when SwiftUI sizes it, so it paints in the same pass.
  - Numbers (median, light; the machine was loaded during most runs, load average 4 to 9; ms):

    | Metric | Current | Native before | Native now |
    | --- | --- | --- | --- |
    | search: first results after the first key | 69 | 1706 | 100 |
    | search: settled after the last key | 5 | 1932 | 6 |
    | echo: a typed key on screen | 19 | - | 20 |
    | diff: first paint | 261 (62 quiet) | 120 to 181 | 177 (132 quiet) |
    | diff: colors in | 673 (297 quiet) | 3200 to 3700 | 260 (199 quiet) |
    | scroll: frames a second | 53 | 60 | 53 |
    | scroll: 95th percentile gap | 44 | 24 | 28 |

  - Left for GM-75: search's first results. Traced on one clock: the second key at ~30 ms, results ready at ~48 ms
    (the same Rust search as the current app), SwiftUI done building the 18 visible rows at ~82 ms, on screen at
    ~103 ms. Creating the rows costs 20 to 34 ms (updating them 12 ms; offscreen 18 rows lay out in 12 ms and draw
    in 5, ExactText's second pass ~3 ms of that), WebKit a few. Plan: draw the result list directly (Core Text in
    one view, as the diff canvas). Also seen: the TextKit 2 field editor invalidates cursor rects on every key, and
    AppKit then sets the cursor again (~4 ms each with the accessibility pointer settings).
  - Pixel diff below the title bar (HDR off), unchanged: diff 99.66% light / 99.67% dark, staged 99.74 / 99.73,
    Log 99.52 / 99.39, search 99.6 / 99.14, quickopen 99.64 / 99.63, palette 99.5 / 99.3, Changes 99.75 / 99.74.
  - Memory (`gm-measure memory`, idle / diff open / scrolling / after, MB): current 140.7 / 208.2 / 880.3 /
    271.4, native 37.1 / 48.6 / 47.0 / 41.9 (idle was 34 to 36 before: the warm-ups keep 1 to 3 MB).
- GM-75 Find in Files' results drawn in one view (search's first results were the one case still slower):
  - Built: ResultsCanvas (NSView) draws the visible rows into one see-through bitmap, as the page's scrolled list
    is a layer of its own: the match boxes stored as the page stores a translucent fill (layerFill), the texts
    blended by GlyphCompositor at their exact fractional x, the file icon stroked on the whole point. The selected
    row's background is a Core Animation layer under it (a fill stored in the bitmap came out a step off).
    TextResultsList wraps it with the list's thumb (PopupScrollThumb, now shared with PopupList); clicks and the
    wheel go to the same actions. NativeCore ResultRowLayout places a row's pieces and finds the row under a click
    (tested). ResultText keeps the line's ellipsis and the list's code font; TextResultRow is gone.
  - Rule found: WebKit centers a text in its row by its ascent and descent rounded to whole points (semibold 13 on
    18.0 in a 26-point row, the 11.5 and 13-point mono and 12 and 11-point UI fonts on 17.5); the count's half-point
    offset was SwiftUI's way to land there.
  - The caret of the popups' query field takes the text color, as the page's caret-color: auto does (it was blue).
  - Speed (median of 5, light, load average ~3.5; ms): first results after the first key current 86, native 81
    (was 100); settled after the last key 9 / 10 (noise); echo 26 / 22. Trace before: results ready ~48 ms, rows
    built ~82, on screen ~103; WebKit draws them in a few ms.
  - Pixel diff below the title bar (HDR off): search 99.45% light (99.6 with the SwiftUI rows), 99.22% dark
    (99.17). Left: text over a match box is a level off in one channel (in the bitmap, over the box), and the
    selected row's boxes a level off (as they were). Quick Open 99.64 / 99.63, palette 99.51 / 99.3 kept.
  - Memory (`gm-measure memory-search`, MB average): Find in Files results native 49.2 (57 with the SwiftUI rows),
    current 195.8; idle 35.8 / 139.1.
  - Not changed yet: the TextKit 2 field editor invalidates its cursor rects on every key and AppKit then sets the
    cursor again (~4 ms each with the accessibility pointer settings); the empty results list's 2 + 4 points of
    padding.
- GM-76 a diff on screen sooner, and fewer window renders:
  - Found: the current app's "first paint" was its tab over an empty editor (frames at 107 ms); its code showed at
    ~370 ms. gm-measure speed now also reports "diff: code on screen" (the first frame whose region has ink on at
    least 5% of its sampled pixels, FrameRecorder's per-frame ink) and calls the other "first change".
  - Built: opening the first diff shows its tab over an empty editor at once while the texts are read (DiffStore
    pendingName), as the page does; with a diff open, that diff stays until the new one is ready. openDiff and the
    memory readout moved out of AppModel into DiffStore and MemoryReadout (AppStores.swift; AppModel forwards
    them), and the status bar's file items moved from ContentView into StatusBarView: opening a diff rendered every
    view observing AppModel, ContentView included (which observed the editor only for those items), and the
    readout did the same every 2 seconds. The diff tab is revealed in the same pass as the new diff. Traced: a diff
    open now renders MainArea, the diff screen, the status bar and the Changes rows only.
  - Speed (median of 5, light, ms): first change current 108, native 50; code on screen 327 / 151; colors in
    368 / 243.
  - Pixel diff below the title bar (HDR off), unchanged: Changes 99.74 / 99.74, diff 99.66 / 99.67, staged 99.74 /
    99.73, file 99.64 / 99.63, Log 99.52 / 99.39, search 99.45 / 99.25 (light / dark).
- GM-77 search's first results, clearly ahead:
  - Traced: the results' polling Task started ~10 ms after the keystroke (it waited for the main thread to draw
    the typed key); the results canvas was made with the first rows and was sometimes sized a pass later; and
    AppKit set the cursor again inside every frame's commit after a key (its tracking areas follow SwiftUI's
    layout), each set registering the cursor's images with the window server with the accessibility pointer
    settings: in a sample more time than the layout itself.
  - Built: the first poll starts off the main thread at the keystroke (with rows on screen it gathers up to 15 ms,
    so one update lands); once the visible rows are filled, later batches come together (up to 40 ms or the end
    of the search). The results canvas stays mounted at 0 points while there are no rows. CursorGuard skips a
    cursor set when the same cursor is set again with the mouse where it was (any mouse move lets the next set
    through). The popups' query field has a TextKit 1 field editor (QueryFieldCell): the TextKit 2 one
    invalidated its cursor rects on every key.
  - gm-measure: KeyPoster.type no longer sleeps after the last key, so "settled after the last key" is timed from
    that key (it was 30 ms late and hid changes inside those 30 ms).
  - Speed (median of 5, light, ms): first results current 85, native 70; settled after the last key 37 / 29; a
    typed key on screen 20 / 17.
  - Pixel diff below the title bar (HDR off): search 99.46 / 99.22, Quick Open 99.64 / 99.63, palette 99.51 /
    99.29 (light / dark), as before.
- GM-78 several windows (src-tauri/src/windows.rs and commands/window.rs, repoPicker.ts openInNewWindow):
  - Refactor: WindowContext holds one window's models (app, workspace, editor, Log, Files, terminal, merge tool,
    search popups, open diff, toasts, Clone dialog, context menu). The per-window models lost their `shared`
    instances; they reach each other through `context`, views read them from the environment (`windowContext(_:)`
    puts every model there), and the control server acts on `WindowContext.focused` (the key window, else the one
    focused last). Settings, recent projects, diff preferences and the memory readout stay the app's; the Settings
    dialog shows in the window that opened it; the memory readout is read by the oldest window only. Key monitors
    (search keys, Ctrl+`, Cmd+Return in the commit box, the welcome list, Settings' Escape, the merge tool, the
    context menu) act on their own window's events only. Every measured screen in light mode kept its score on the
    refactor alone (30 screens, 99.2 to 99.87%).
  - Windows: a WindowGroup of WindowRequest values; WindowRoot gives each window its context, the first one taking
    the start arguments (-folder, -folders, -workspaceFile, git mergetool). WindowOpener opens a window 1400 x 880,
    28 points down and right of the one it came from, or brings to the front the window that already shows the
    folders (NativeCore WindowOwnership, tested: a workspace file, the window showing it; one folder, a window with
    it; several, a window with exactly those). Opening a folder or workspace file in a window does the same. File >
    New Window (Shift+Cmd+N), the folder menu's New Window, Open Folder in New Window and Open Recent in New Window,
    the welcome row's Open in New Window and the welcome list's Open Folder in New Window work.
  - Control and measuring: `app new_window` (folderPaths, workspaceFile) and `list_windows`; smoke checks both
    windows rules; gm-measure `--screen newwindow` opens acme, then New Window in both apps (the current app's
    run_menu_command file.newWindow) and captures the new window (WindowCapture.pinned). gm-measure's memory report
    adds up processes of the same name (two windows of the current app have two web content processes).
  - Pixel diff below the title bar (HDR off): newwindow 99.76% light, 99.41% dark.
  - Memory with two windows (newwindow): current 260.3 MB, native 53.9 MB.
  - Not built: Window > Close Window with its unsaved-edits check, events about a path sent only to the windows it concerns. DiffState.shown and MergeScrollSync.shown
    (read by the control server only) are the last drawn, not per window.
- GM-79 the window session (windows.rs session_to_json, parse_session, restore_plan, on_screen; commands/window.rs
  save_session and restore_at_start):
  - NativeCore WindowSession (tested): the state.json "windows" list of each window's folders or workspace file and
    its frame (top left, y down, and content size); malformed parts dropped, the same workspace once, at most 20
    windows, frames that are too small or too far dropped; the start plan (nothing when the app was started on a
    folder; with "Reopen windows on start" off only the first window's folders); a frame counts as on screen when
    100 x 15 points of its top edge are on one.
  - WindowSessionKeeper saves the session to ~/.gitmanager-native/state.json (RecentProjectsStore keeps the other
    keys) when a window shows another workspace, moves or resizes (half a second later), closes, and at quit, where
    every window stays; the last window closed is kept. Nothing is saved as git mergetool. At start on nothing, the
    first window takes the session's first entry and the others open after it, each at its saved size, and at its
    place when that is still on a screen (else centered). The Settings row "Reopen windows on start" now switches
    and saves (SettingsCatalog.workingToggles).
  - Smoke: a session of two windows (the welcome screen, the test repository at 1100 x 700) opens both again, the
    second at its size, and state.json holds both while the app runs. gm-measure's launcher can wait for the
    control server only (readyOnAnswer), for a start that shows a restored session.
  - Pixel diff below the title bar (HDR off, light), unchanged: welcome 99.87%, welcomerecent 99.62%, closefolder
    99.82%, Changes 99.74%, newwindow 99.76%.
  - Not checked by a person yet: quitting with Cmd+Q and starting again (gm-measure stops apps with SIGTERM, which
    skips the quit hook; the session saved while running covers it).
- GM-80 Settings > GitHub (src-tauri/src/github, GitHubSignInForm.svelte, githubModel.ts):
  - Bridge: src-tauri's GitHub account, client, gh, http, secrets and service files (bridge/src/github), with the
    bridge's own commands (commands/github.rs): github_account, github_cli_status, github_sign_in_with_token,
    github_sign_in_with_cli, github_sign_out, github_share_project, github_repository, github_sync_fork,
    github_create_gist. The native app keeps its own account file (~/.gitmanager-native/github.json) and its own
    keychain item (service shibbirweb.github.io.gitmanager.native.github), so signing in or out never touches the
    current app's sign-in. New dependencies at src-tauri's versions: ureq (system TLS) and keyring. Tests without
    the network or the keychain (bridge/tests/github.rs): the account file, a token refused before GitHub is asked,
    a gist needing a sign-in, a repository name checked first.
  - NativeCore GitHubModel: githubModel.ts with its tests (repository and remote names, gist file names, the fork's
    branch and compare link, initials, the missing-scope warning).
  - Settings > GitHub: the account row is stacked as the page's .row.stacked (SettingsRow `below`), with
    GitHubAccountForm: signed out, the token field (a PageInput, now shared with the Clone dialog, as a password
    field with the code font's ligatures), Sign In (Return too), the hint with its code words and the "create one
    on GitHub" link (RichParagraph: words of several fonts on one baseline, a line with code a point taller below),
    and Use GitHub CLI when gh is installed; signed in, the 32-point avatar with the initials, the login, the name,
    host and source, Sign Out (asked first) and the missing-scope warning. DialogButton gained `small` (.btn.small).
  - Rules found: a row without a control is all label (its 20-point gap overflowed the row); a section that does
    not scroll has rows 524 points wide (the scrollbar takes no room; settingsRowsWidth) and the dialog's shadow
    painted with the dim (shadowInOverlay); a plain <code> outside the dialog's styles is Menlo at the hint's 12
    points; a hint line's box is 17 points, which centers the avatar and the button.
  - gm-measure `--screen settingsgithub` (signed out) and `settingsgithubaccount` (a github.json seeded in both
    apps' folders, a token missing the gist scope). Parity: the github scenario runs (openSettings github).
  - Pixel diff below the title bar (HDR off): settingsgithub 99.39% light, 99.42% dark; settingsgithubaccount
    99.42% / 99.46%; Settings (Appearance) kept 99.51 / 99.1.
  - Memory on Settings > GitHub: current 222 MB, native 48 MB. The app binary is 18.4 MB.
  - Not built yet: Git > GitHub (Share Project on GitHub, Sync Fork, Create Gist) and the sign-in dialog they open.
    Not tried with a real token (the keychain is the user's own; the bridge tests stay off it).

- GM-81 Git > GitHub (githubActions.ts, GitHubDialogHost.svelte and its dialogs):
  - Bridge: list_remotes, push_with_options, fetch_all and git_progress (commands/remote.rs), the same git calls as
    src-tauri's remote commands, with the push's progress lines in a slot as Clone's are. Tests (bridge/tests/
    remote.rs): the remotes listed, a push that sets the upstream and a fetch, a remote name like an option refused.
  - NativeCore GitHubRemotes (tested): owner and repository from a github.com URL (HTTPS, SSH, ssh://), and the
    remote to use: the branch's upstream remote, else origin, else the first one on GitHub.
  - GitHubCenter (one per window, in WindowContext): Share Project on GitHub, Sync Fork and Create Gist, each asking
    to sign in first when there is no account and running again once signed in; the one GitHub dialog open.
    Sync Fork asks first (NSAlert), syncs on GitHub, then fetches; a conflict ends in a result dialog with the
    compare link. Create Gist takes the editor's selection, else the whole file.
  - Dialogs on GitDialogFrame (the Git dialogs' frame, now shared with Clone) and GitDialogParts (.field, .hint and
    .error lines, .check, the visibility switch, the progress line): Sign In to GitHub (the Settings account form at
    the dialog's width, its token field taking the keyboard), Share Project on GitHub (name, Private, Remote and
    Description at 1 : 2, the initial commit for a repository without commits, progress, errors kept in the
    dialog, then the push and a result dialog), Create Gist (file name, Secret / Public, description, the preview)
    and the result dialog (message, the link in the code box, Copy Link, Close, Open). Public asks first.
  - Entry points: the command palette's git.github.share, syncFork and createGist, and a Git menu with a GitHub
    submenu in the menu bar. Control: `app run_menu_command` (command git.github.*) and `app github_dialog`.
  - Rules found: WebKit's focus() leaves the caret after the text, AppKit selects it all (SearchInput now puts the
    caret at the end); the checkbox row is 2 points taller than the checkbox and sits 2 points in; a <pre> lays
    out no line after a final newline; TextKit 2 drops a fixed line height once the text has a baseline offset
    (the preview uses TextKit 1); NSScrollView adds a 15-point corner view even with 10-point scrollers; the
    segmented fill needs the unrounded color (one unit off otherwise). The preview's line height is 16 points
    (11.5 x 1.45 as WebKit lays it out) and its thumb follows WebKit's length (track x visible / content).
  - gm-measure `--screen githubsignin` (signed out, Share Project), `githubshare` and `githubgist` (a seeded
    github.json; githubgist opens src/catalog.ts first).
  - Pixel diff below the title bar (HDR off, light / dark): githubsignin 99.48 / 99.44, githubshare 99.48 / 99.43,
    githubgist 99.32 / 99.14; welcomeclone kept 99.59 / 99.5 on the shared frame.
  - Memory with the dialog open (light, average, current / native): Sign In 222.7 / 43.7 MB, Share Project
    220.7 / 43.0 MB, Create Gist (a file open) 261.1 / 51.2 MB.
  - Not measured: the result dialog and Sync Fork's question (they need GitHub). Not tried with a real token yet.
    Not built: Open on GitHub, Copy GitHub Link, Create Pull Request and View Pull Requests.
- GM-82 Settings > Automation (SettingsDialog.svelte's automation section, src-tauri/src/mcp configure):
  - Bridge: the control server follows the settings like the current app's (control/server.rs): nothing listens
    while the MCP server and the command line tool are both off; on, it listens on 127.0.0.1 at mcpPort (default
    48731), restarting on a port change; a request from `git-manager cli` (x-git-manager-client: cli) needs the
    command line switch, any other request the MCP switch (403 otherwise); initialize reports both. The token
    stays in mcp.json between runs (mode 0600, written atomically), the port and pid only while listening; New
    Token replaces it. Commands mcp_configure, mcp_status, mcp_regenerate_token; gm_control_start became
    gm_control_install (the UI handler only). Tests: off means no listener and no file; the CLI header gated; the
    same port keeps running; stopping keeps the token and drops the port; New Token refuses the old one; port 80
    refused.
  - App: McpServerStore applies the switches and port at launch and on change (one after another, off the main
    thread) and keeps the status. NativeCore McpConnect (tested): parseMcpPort, the Claude Code command, the JSON
    config as JSON.stringify lays it out, the masked token, the examples. NativeCore TextWrap.preWrapLines
    (tested): pre-wrap with overflow-wrap anywhere, so a command breaks at a space before "http://".
  - Settings > Automation now as the current app: the MCP server switch, Status (Running at the URL, the error in
    --danger, or Off) with Available MCP Tools..., Port (.number-input, Return applies, a bad number shows the
    page's message), and with a token: Secret token (dots, Show / Hide, Copy, New Token in --danger), Connect
    Claude Code and Other MCP clients (.command boxes with Copy); the command line switch, Install (the native
    app has none of its own: the current app's reaches it with HOME=~/.gitmanager-native) and Examples; then the
    memory log switch as before. RowControl gained `.view` and CatalogItem `.custom`; DialogButton `danger`.
  - Rules found: a group title's line is 13 points in WebKit (rounded ascent and descent of 11-point SF), a point
    less than SwiftUI's; a row's label needs a point of slack over its measured width or a hint can wrap its last
    word (it did in dark, at another port number).
  - gm-measure: both apps now start with the server and the command line tool on, on a free port (the native
    app's settings.json keeps the values a run wrote first). `--screen settingsautomation` puts both apps on one
    port. Parity: the automation scenario (the mcp feature) runs.
  - Pixel diff below the title bar (HDR off, light / dark): settingsautomation 99.51 / 99.14; settings kept
    99.51 / 99.11, settingsgithub 99.4 / 99.42, settingsgithubaccount 99.42 / 99.46.
  - Memory on Settings > Automation (server on): current 221 MB, native 51 MB.
  - Changed for anyone driving the native app by hand: `HOME=~/.gitmanager-native git-manager cli ...` needs the
    MCP server or the command line tool switched on in the native app's Settings > Automation first.
  - Not built: the Available MCP Tools dialog (tool switches), the activity list, more tools in the server.
- GM-83 the current app's git tools in the native MCP server:
  - src-tauri/src/mcp/tools/git_read.rs and patch.rs, and src/mcp/paths.rs, included by path in the bridge
    (control/backend): git_diff, git_log, git_show_commit, git_branches, git_remotes, git_stashes, git_blame,
    git_file_history, git_line_history, git_conflicts, git_compare_branches, git_worktrees, git_submodules and
    git_console_entries, with the current app's names, schemas, checks and results. The native git_status stays
    (repoPath optional, the window's repository). control/backend stands in for src-tauri's tools/mod.rs: the
    same Args, ToolCtx (the window's workspace folders, from get_state), helpers and a small block_on for the
    commands' async functions. Two commands the tools call are repeated in the bridge with the Tauri shape:
    commands::remote::list_remotes and commands::branch_actions::compare_branches.
  - Tests (bridge/tests/control_tools.rs): git_log, git_branches, git_compare_branches, git_diff of a commit and
    git_remotes over HTTP inside the workspace; a repository outside the workspace is refused.
  - Next: the git write tools (they need the bridge's write commands in the Tauri shape), files and search, then
    the Available MCP Tools dialog with the tool switches.
