// Settings > Editor (after the color themes), Git and Layout, as SettingsDialog.svelte draws them, with the defaults
// of src/lib/stores/settingsData.ts. Keep in step with those files.

import SwiftUI

enum SettingsCatalogData {
    static let editor: [CatalogItem] = [
        .field("Editor font family", "A comma-separated list. The first installed font is used; monospace is always "
            + "added as the last fallback.", .input, "'JetBrains Mono', Menlo, Monaco, 'Cascadia Mono', Consolas"),
        .range("Editor font size", "Code in the editor, diffs and the merge tool.", fraction: 0.3, value: "13px"),
        .range("Editor font weight", "How thick code is drawn. Light (300) looks calm on dark themes. Needs a font "
            + "with several weights, such as JetBrains Mono or SF Mono; other fonts use their closest weight.",
            fraction: 0.375, value: "Regular", valueWidth: 76),
        .range("Line spacing", "Space between lines of code, as a multiple of the font size. The default is 1.25.",
               fraction: 0.1667, value: "1.25"),
        .toggle("Change font size with Ctrl + mouse wheel", "Hold Control (or Command) and scroll over an editor, "
            + "diff or merge pane to make the code bigger or smaller. A trackpad pinch works too.",
            key: "mouseWheelZoom", on: false),
        .toggle("Font ligatures", "Draw =>, !=, === and similar as single glyphs. Needs a font with ligatures such "
            + "as Fira Code, JetBrains Mono or Cascadia Code; Menlo has none.", key: "fontLigatures", on: false),
        .toggle("Syntax highlighting", "Color code by its language in editors, diffs, the merge tool and Markdown "
            + "code blocks. Off, code is plain text and no language grammar is loaded, which saves memory with big "
            + "files.", key: "syntaxHighlighting", on: true),
        .choice("Tab size", "Spaces per indent level, and the width of a tab, for files whose indentation is not "
            + "detected.", labels: ["2", "4", "8"], values: ["2", "4", "8"], key: "tabSizeText", value: "4"),
        .toggle("Detect indentation", "Indent like the file already does: tabs or spaces, and how many. Also in "
            + "View > Detect Indentation.", key: "detectIndentation", on: true),
        .choice("Render whitespace", "Only in selected text. Spaces show as dots and tabs as arrows, in editors, "
            + "diffs and the merge tool.", labels: ["None", "Boundary", "Selection", "Trailing", "All"],
            values: ["none", "boundary", "selection", "trailing", "all"], key: "renderWhitespace", value: "selection"),
        .toggle("Word wrap", "Wrap long lines in the file editor. Diffs and the merge tool never wrap so their panes "
            + "stay aligned.", key: "wordWrap", on: false),
        .field("Cursor style", "The shape of the cursor in editors, diffs and the merge tool.", .select, "Line"),
        .range("Cursor width", "How thick the Line cursor is, in pixels. The default is 2.", fraction: 0.2,
               value: "2px"),
        .field("Cursor blinking", "Fades out and in. The cursor stays visible while you type.", .select, "Blink"),
        .toggle("Smooth caret animation", "The cursor glides to its new place instead of jumping.",
                key: "editorCursorSmoothCaret", on: false),
        .range("Caret extra top", "Pixels the cursor reaches above the text, so it is easier to see.", fraction: 0,
               value: "0px"),
        .range("Caret extra bottom", "Pixels the cursor reaches below the text.", fraction: 0, value: "0px"),
        .group("Editing features"),
        .toggle("Auto-close brackets and quotes", "Typing ( [ { or a quote adds the closing one.",
                key: "editorAutoCloseBrackets", on: true),
        .toggle("Code completion", "Suggest words from the file and the language's keywords. Ctrl+Space opens the "
            + "list; Enter or Tab accepts.", key: "editorCompletion", on: true),
        .toggle("Show completion while typing", "Off, only Ctrl+Space opens the list. Markdown and plain text always "
            + "wait for Ctrl+Space.", key: "editorCompletionOnTyping", on: true, sub: true),
        .toggle("Fold arrows", "Arrows beside the line numbers fold and unfold blocks in the file editor.",
                key: "editorFoldGutter", on: true),
        .toggle("Indent guides", "Faint lines at each indent level, also in diffs and the merge tool.",
                key: "editorIndentGuides", on: true),
        .toggle("Highlight the word at the cursor", "Mark the other uses of that word.", key: "editorHighlightWord",
                on: true),
        .toggle("Scroll past the end", "Scroll the last line up to the top of the file editor.",
                key: "editorScrollPastEnd", on: true),
        .toggle("Column selection", "Option+drag selects a rectangle of text.", key: "editorColumnSelection",
                on: true),
        .toggle("Sticky scroll", "Keep the lines of the blocks you are in pinned at the top of the file editor. "
            + "Click one to jump to it.", key: "editorStickyScroll", on: true),
        .toggle("Minimap", "A small picture of the whole file beside the scrollbar of the file editor.",
                key: "editorMinimap", on: false),
        .toggle("Bracket pair colors", "Color brackets by how deep they are nested, also in diffs and the merge "
            + "tool.", key: "editorBracketPairColors", on: true),
        .toggle("Highlight matching brackets", "Mark the bracket that pairs with the one at the cursor.",
                key: "editorMatchBrackets", on: true),
        .toggle("Right margin line", "A thin line at a column in editors, diffs and the merge tool.",
                key: "editorRulerOn", on: false),
        .group("Tabs"),
        .toggle("Reopen tabs on start", "Open the files a folder or workspace had in tabs last time, also when you "
            + "open it again later. Each file loads when you first show its tab.", key: "reopenTabsOnStart", on: true),
        .toggle("Recent Files", "Cmd+E lists the files you worked on last, and Quick Open and Search Everywhere show "
            + "them first. Each workspace keeps up to 50 in state.json.", key: "recentFiles", on: true),
        .toggle("Split editor", "Show groups of tabs side by side or stacked with Window > Split Right and Split "
            + "Down. Turning it off moves every tab into one group.", key: "splitEditor", on: true),
        .toggle("Wrap tabs", "Show tabs that do not fit on more rows instead of scrolling them sideways.",
                key: "wrapTabs", on: false),
        .choice("Tab limit", "Open as many tabs as you like. Tabs with unsaved changes and pinned tabs always stay "
            + "open.", labels: ["No limit", "Single tab", "Limit"], values: ["none", "single", "limit"],
            key: "tabLimitText", value: "none"),
        .toggle("Unload hidden tabs", "A file tab you have not looked at for a while gives its editor back, about 4 "
            + "MB each. The tab stays, and opening it again goes back to the same place.", key: "unloadHiddenTabs",
            on: true),
        .group("Saving"),
        .choice("Auto save", "Save only with Save.", labels: ["Off", "After a delay", "On focus change"],
                values: ["off", "afterDelay", "onFocusChange"], key: "autoSave", value: "off"),
        .toggle("Remember unsaved changes", "Keep the text of new files and unsaved edits when you close the window "
            + "or quit, and bring the tabs back with it next time. Off, closing asks before unsaved changes are "
            + "lost.", key: "rememberUnsaved", on: true),
        .toggle("Trim trailing whitespace", "Remove spaces and tabs at the end of lines. Markdown keeps two spaces "
            + "at a line end, since they make a line break there.", key: "trimTrailingWhitespace", on: false),
        .toggle("Insert final newline", "End the file with a newline when it has none.", key: "insertFinalNewline",
                on: false),
        .toggle("Trim final newlines", "Remove blank lines after the last line of text.", key: "trimFinalNewlines",
                on: false),
        .group("Local History"),
        .toggle("Keep local history", "Keeps a version of a file on every save, when it changes outside the app and "
            + "before Discard, Rollback or Revert. Files over 1 MB are skipped.", key: "localHistoryEnabled",
            on: true),
        .group("Preview and blame"),
        .choice("Markdown preview", "How Markdown files open. Each file can switch with the buttons at the top right "
            + "of its editor and keeps its choice until the app restarts.",
            labels: ["Editor only", "Editor and preview", "Preview only"], values: ["editor", "split", "preview"],
            key: "markdownViewMode", value: "split"),
        .toggle("Current line blame", "Show the author, age and commit of the cursor line at its end.",
                key: "currentLineBlame", on: true),
        .toggle("Blame gutter", "A column with the commit, author and age of every block of lines. Also toggled "
            + "with the Blame button in the path bar and the diff toolbar.", key: "blameGutter", on: false),
    ]

    static let git: [CatalogItem] = [
        .choice("Diff layout", "Show every diff side by side, or inline in one column with removed lines above the "
            + "lines that replace them. The two buttons in the diff toolbar change this setting too.",
            labels: ["Side by side", "Inline"], values: ["sideBySide", "inline"], key: "diffLayout",
            value: "sideBySide"),
        .toggle("Ignore whitespace in the merge tool", "Start merges with whitespace-only differences hidden. The "
            + "Ignore whitespace button in the merge tool changes this setting too.", key: "ignoreWhitespace",
            on: false),
        .toggle("Show all branches in the log", "Include every local and remote branch, like git log --branches "
            + "--remotes. Tags and stashes are not followed.", key: "logAllRefs", on: true),
        .toggle("Auto fetch", "Fetch every remote in the background while the window is in use, one repository at "
            + "a time.", key: "autoFetch", on: true),
        .field("Fetch every", "Minutes, from 1 to 60. The default is 5.", .input, "5", sub: true),
        .toggle("Sign off commits", "Add a Signed-off-by trailer to every commit (--signoff). Also in Commit "
            + "Options.", key: "commitSignOff", on: false),
        .field("GPG sign commits", "Default follows commit.gpgSign; Sign adds -S, Do not sign adds --no-gpg-sign.",
               .select, "Default"),
        .toggle("Git Console", "Keep a list of the git commands the app runs, with their output. Off, nothing is "
            + "recorded or loaded.", key: "gitConsole", on: false),
        .group("Commit identity"),
        .text("Name and email", "Written into every commit (user.name and user.email). A repository's own values "
            + "win over the global ones; leave a field empty to remove it."),
        .group("Commit messages"),
        .toggle("Message history", "The clock in the commit box lists your recent commit messages and messages that "
            + "were not committed.", key: "commitMessageHistory", on: true),
        .toggle("Subject line guide", "A note under the commit box when the first line is longer than 72 "
            + "characters.", key: "commitSubjectGuide", on: true),
        .text("Templates", "Picked from the page icon in the commit box. A commit.template set in git config also "
            + "fills an empty commit box."),
    ]

    static let layout: [CatalogItem] = [
        .toggle("Do not disturb", "Only errors pop up. Every message is still kept in the bell at the bottom right.",
                key: "notificationsDoNotDisturb", on: false),
        .toggle("Files panel", "Show the file tree on the right.", key: "explorerOpenSetting", on: true),
        .toggle("Confirm drag and drop", "Ask before dragging files or folders in the Files panel moves them.",
                key: "confirmDragAndDrop", on: true),
        .choice("Left sidebar", "Also toggled from the activity bar.", labels: ["Changes", "Branches", "Scripts"],
                values: ["changes", "branches", "scripts"], key: "leftPanelSetting", value: "changes"),
        .toggle("Reopen windows on start", "Open every window that was open when you quit, each with its folders. "
            + "Off: only the last folders you had open.", key: "reopenWindows", on: true),
    ]
}
