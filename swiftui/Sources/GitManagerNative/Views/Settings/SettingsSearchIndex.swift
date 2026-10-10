// The Settings search index of the current app (src/lib/views/settings/settingsSearch.ts, SECTION_ENTRIES): every
// row and group title with the extra words that find it. Keep it in step with that file.

import NativeCore

enum SettingsSearchIndex {
    static let sections: [(id: String, label: String)] = [
        ("appearance", "Appearance"), ("editor", "Editor"), ("merge", "Git"), ("layout", "Layout"),
        ("terminal", "Terminal"), ("keyboard", "Keyboard Shortcuts"), ("github", "GitHub"),
        ("automation", "Automation"), ("updates", "Updates"), ("files", "Settings Files"), ("about", "About"),
    ]

    static let sectionLabels = Dictionary(uniqueKeysWithValues: sections.map { ($0.id, $0.label) })

    static let entries: [SettingsSearchEntry] = specs.flatMap { section, rows in
        rows.map { SettingsSearchEntry(section: section, label: $0.0, keywords: $0.1) }
    }

    /// The extra words of a row or group title.
    static func keywords(section: String, label: String) -> String {
        entries.first { $0.section == section && $0.label == label }?.keywords ?? ""
    }

    private static let specs: [(String, [(String, String)])] = [
        ("appearance", [
            ("Theme", "light dark system mode macos appearance"),
            ("Rounded panels", "islands corners gap radius layout"),
            ("File toolbar", "path bar breadcrumbs navigation top bottom hidden"),
        ] + AppearanceSection.toolbarParts.map { ($0.label, "file toolbar \($0.hint)") } + [
            ("Interface font size", "ui text zoom menus lists buttons"),
            ("File icons", "material minimal icon set type"),
        ]),
        ("editor", [
            ("Color theme", "colour scheme syntax highlighting light dark"),
            ("Editor font family", "typeface monospace"),
            ("Editor font size", "text zoom code"), ("Editor font weight", "thin light bold thickness"),
            ("Line spacing", "line height leading"),
            ("Change font size with Ctrl + mouse wheel", "zoom scroll pinch trackpad command"),
            ("Font ligatures", "glyphs fira code arrows"),
            ("Syntax highlighting", "colors grammar language plain text memory"),
            ("Tab size", "indent spaces width"), ("Detect indentation", "indent tabs spaces"),
            ("Render whitespace", "show spaces tabs dots invisible characters"), ("Word wrap", "soft wrap long lines"),
            ("Cursor style", "caret line block underline shape"), ("Cursor width", "caret thickness"),
            ("Cursor blinking", "caret blink phase smooth solid"), ("Smooth caret animation", "cursor glide"),
            ("Editing features", "ide"), ("Show completion while typing", "autocomplete suggestions"),
            ("Right margin line", "ruler guide column vertical line"), ("Margin column", "ruler guide"),
            ("Tabs", "editor tabs"), ("Reopen tabs on start", "restore session files"),
            ("Recent Files", "cmd e recently opened mru"),
            ("Split editor", "split right down side by side stacked vertically horizontally groups"),
            ("Wrap tabs", "multiple rows"), ("Tab limit", "max close least recently used"),
            ("Most file tabs", "tab limit number"), ("Single tab title", "one tab name centered"),
            ("Unload hidden tabs", "memory sleep free editors background"), ("Unload after", "minutes hidden tabs"),
            ("Saving", "save"), ("Auto save", "autosave save automatically focus change"),
            ("Delay", "auto save milliseconds"),
            ("Remember unsaved changes", "hot exit untitled new file keep restore quit backup"),
            ("Local History", "versions backup restore"), ("Keep local history", "versions backup restore"),
            ("Keep versions for", "local history days"), ("Size limit", "local history disk space"),
            ("Stored", "local history clear disk usage"), ("Preview and blame", "markdown annotate"),
            ("Markdown preview", "md view render"), ("Current line blame", "annotate author inline git lens"),
            ("Blame gutter", "annotate author column"),
        ]),
        ("merge", [
            ("Diff layout", "side by side inline unified split one column compare view"),
            ("Ignore whitespace in the merge tool", "conflicts spaces"),
            ("Show all branches in the log", "history graph remotes"), ("Auto fetch", "background fetch remotes"),
            ("Fetch every", "auto fetch minutes interval"), ("Sign off commits", "signed off by trailer dco"),
            ("GPG sign commits", "signing signature ssh key"), ("Git Console", "commands output log"),
            ("Commit identity", "author"), ("Name and email", "user name email author identity"),
            ("Commit messages", "message"),
            ("Commit box", "commit box per repository single bottom vs code jetbrains layout"),
            ("Message history", "recent commit messages"),
            ("Subject line guide", "72 characters length commit message"), ("Templates", "commit message template"),
        ]),
        ("layout", [
            ("Do not disturb", "notifications toasts quiet"), ("Files panel", "file tree project explorer"),
            ("Confirm drag and drop", "move files ask"), ("Left sidebar", "activity bar cmd b side"),
            ("Reopen windows on start", "restore session windows"),
        ]),
        ("terminal", [
            ("Shell", "shell"), ("Default shell", "zsh bash fish login"), ("Font", "terminal font"),
            ("Font family", "terminal typeface monospace"), ("Font size", "terminal text zoom"),
            ("Line height", "terminal line spacing"), ("Letter spacing", "terminal character spacing"),
            ("Font weight", "terminal bold medium"), ("Bold text weight", "terminal bold"),
            ("Font ligatures", "terminal glyphs"),
            ("Icons from patched fonts", "nerd font powerline starship powerlevel10k"), ("Cursor", "terminal caret"),
            ("Cursor style", "terminal caret block bar underline"), ("Cursor blink", "terminal caret"),
            ("Behavior", "terminal"), ("Scrollback", "terminal history lines buffer"),
            ("Copy on selection", "terminal clipboard"), ("Find in terminal", "search output cmd f"),
            ("Clickable file paths", "links open file"), ("Drop files to type their paths", "finder drag"),
            ("Visual bell", "terminal beep flash"), ("Smooth scrolling", "terminal scroll animation"),
            ("Option as Meta key", "alt emacs"), ("Keyboard", "terminal shortcuts keys"), ("Rendering", "terminal"),
            ("GPU acceleration", "webgl renderer graphics"), ("Unicode 11 widths", "emoji wide characters"),
        ]),
        ("github", [("GitHub account", "sign in login token gist fork share")]),
        ("automation", [
            ("MCP server", "model context protocol ai agent claude cursor"), ("Status", "mcp server running"),
            ("Port", "mcp server network"), ("Secret token", "mcp password key"),
            ("Connect Claude Code", "mcp ai agent"), ("Other MCP clients", "mcp json config"),
            ("Command line tool", "cli terminal scripts git-manager"), ("Install", "cli command line tool"),
            ("Examples", "cli command line tool"), ("Memory log", "ram debug"), ("Log memory changes", "ram debug"),
            ("Read memory every", "memory log interval"), ("Write a line when it changes by", "memory log threshold"),
            ("Log file", "memory log"),
        ]),
        ("updates", [
            ("Version", "update check"), ("Check for updates automatically", "auto update new release"),
            ("Update channel", "beta stable pre-release"), ("Release notes", "changelog what's new"),
            ("Skipped version", "update"),
        ]),
        ("files", [
            ("Settings folder", "settings.json state.json config gitmanager path"),
            ("Changed from defaults", "modified settings"),
        ]),
        ("about", [
            ("Star on GitHub", "about"), ("Report a Bug", "issue feedback problem"),
            ("Request a Feature", "idea feedback suggestion"), ("Release Notes", "changelog what's new"),
        ]),
    ]
}
