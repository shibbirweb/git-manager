// Quick Open (Cmd+P, Shift+Cmd+P for the Command Palette) and Search Everywhere's Text tab (Find in Files,
// Shift+Cmd+F), as src/lib/quickOpen/QuickOpen.svelte and src/lib/search/FileSearch.svelte run them: the typed
// text, the rows (NativeCore's ports of the page's models), the selection, and the backend's file index and text
// search (bridge: file_search_*, text_search). One popup at a time, like the current app.

import AppKit
import NativeCore

@MainActor
final class SearchPopups: ObservableObject {
    /// The window this belongs to (WindowContext).
    weak var context: WindowContext!

    enum Kind: Equatable {
        case quickOpen
        case search
    }

    @Published private(set) var kind: Kind?
    @Published var value = ""
    /// Quick Open: the files mode's matches from the index; Search: the Text tab's results.
    @Published private(set) var fileResults: [SearchRow] = []
    @Published private(set) var fileIndexing = false
    @Published private(set) var text = TextResults()
    @Published private(set) var textRunning = false
    @Published var selected = 0
    @Published var scrollTop: Double = 0
    /// Whole selection of the field's text when it opens (Search Everywhere selects its starting query).
    @Published private(set) var selectAllRequests = 0
    let recent = RecentFiles.shared
    private var fileRequest = 0
    private var textSearchId: UInt64 = 0
    private var retry: Task<Void, Never>?

    var roots: [String] {
        context.app.repoPath.map { [$0] } ?? []
    }

    var folders: [FolderRef] {
        roots.map { FolderRef(root: $0, name: ($0 as NSString).lastPathComponent) }
    }

    // MARK: Opening and closing

    /// Opens Quick Open with `prefix` typed: "" for files, ">" for the Command Palette.
    func openQuickOpen(_ prefix: String) {
        close()
        kind = .quickOpen
        value = prefix
        selected = 0
        scrollTop = 0
        valueChanged()
    }

    /// Opens Search Everywhere on the Text tab with `query` (the editor's selection in the current app), selected.
    func openSearch(_ query: String) {
        close()
        kind = .search
        value = query
        selected = 0
        scrollTop = 0
        selectAllRequests += 1
        openIndex()
        valueChanged()
    }

    func close() {
        guard kind != nil else {
            return
        }
        kind = nil
        retry?.cancel()
        textSearchId += 1
        fileResults = []
        text = TextResults()
        textRunning = false
        let cancelled = textSearchId
        Task.detached {
            try? Backend.perform("text_search_cancel", ["searchId": cancelled])
            try? Backend.perform("file_search_close", [String: String]())
        }
    }

    // MARK: Rows

    var parsed: ParsedQuery {
        QuickOpenModel.parse(value)
    }

    var quickRows: [QuickRow] {
        let parsed = parsed
        switch parsed.mode {
        case .files:
            let recentRows = SearchRows.pathRows(recent.filePaths, folders)
            return QuickOpenModel.filesModeRows(
                query: parsed.text, recent: recentRows, results: fileResults, indexing: fileIndexing,
                hasFolder: !roots.isEmpty
            )
        case .commands:
            let dark = NSApp.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            let list = Palette.list(PaletteCommands.all(dark: dark), query: parsed.text, recent: recent.commandIds)
            let rows = QuickOpenModel.commandRows(recent: list.recent, other: list.other)
            return rows.isEmpty ? [.message(key: "message", label: "No commands match")] : rows
        case .help:
            return QuickOpenModel.helpRows()
        case .line:
            return [.line(key: "line", label: "Open a text editor to go to a line", target: nil)]
        case .symbols:
            return [.message(key: "message", label: "Open a file in the editor to go to its symbols")]
        case .workspaceSymbols:
            return [.message(key: "message", label: "Symbols are not in the native app yet")]
        }
    }

    var quickStatus: String {
        if parsed.mode == .files && fileIndexing {
            return "Indexing files..."
        }
        return QuickOpenModel.label(parsed.mode)
    }

    var textStatus: String {
        TextSearchModel.status(text, running: textRunning)
    }

    // MARK: Queries

    /// The field changed: runs the mode's query, and selects the first row of the new results.
    func valueChanged() {
        selected = 0
        scrollTop = 0
        switch kind {
        case .quickOpen where parsed.mode == .files && !roots.isEmpty:
            openIndex()
            queryFiles(parsed.text)
        case .search:
            runTextSearch()
        default:
            break
        }
        selectFirst()
    }

    func selectFirst() {
        switch kind {
        case .quickOpen:
            selected = QuickOpenModel.firstSelectable(quickRows)
        case .search:
            selected = text.rows.firstIndex { if case .line = $0 { return true }; return false } ?? 0
        case nil:
            selected = 0
        }
    }

    private func openIndex() {
        let roots = roots
        Task.detached {
            _ = try? Backend.call("file_search_open", ["workspaceRoots": roots]) as FileSearchProgress
        }
    }

    private func queryFiles(_ text: String) {
        fileRequest += 1
        let request = fileRequest
        let query = SearchRows.splitLocation(text).text.isEmpty ? "" : text
        guard !query.isEmpty else {
            fileResults = []
            return
        }
        let roots = roots
        let folders = folders
        Task {
            let results = await Task.detached { () -> FileSearchResults? in
                try? Backend.call("file_search_query", FileQueryArgs(workspaceRoots: roots, query: query, limit: 50))
            }.value
            guard request == fileRequest, kind == .quickOpen, let results else {
                return
            }
            fileResults = SearchRows.resultRows(results.items, folders)
            fileIndexing = !results.done
            selectFirst()
            if !results.done {
                retry = Task {
                    try? await Task.sleep(nanoseconds: 250_000_000)
                    if !Task.isCancelled && request == fileRequest {
                        queryFiles(text)
                    }
                }
            }
        }
    }

    private func runTextSearch() {
        textSearchId += 1
        let searchId = textSearchId
        let query = value
        guard TextSearchModel.searchable(query) else {
            text = TextResults()
            textRunning = false
            return
        }
        textRunning = true
        let args = TextSearchArgs(workspaceRoots: roots, searchId: searchId, query: query)
        let folders = folders
        // Streamed as the page streams its result channel: the search runs in the bridge on a thread of its own and
        // each poll waits there for the next batches. Previous results stay until the new ones fill the list's visible
        // rows (or the search ends), so the list never shrinks for a moment; an empty list takes the first rows.
        // Starting only spawns the search's thread, so it runs at once on the keystroke.
        guard (try? Backend.perform("text_search_start", args)) != nil else {
            textRunning = false
            return
        }
        // The first poll starts here, off the main thread, while the typed key is drawn (on the main actor it began
        // ~10 ms later). With rows on screen (kept until new ones fill them) it gathers a little, for one update.
        let firstArgs = TextPollArgs(searchId: searchId, waitMs: 50, gatherMs: text.rows.isEmpty ? 0 : 15)
        let firstPoll = Task.detached(priority: .userInitiated) { () -> TextSearchPoll? in
            try? Backend.call("text_search_poll", firstArgs) as TextSearchPoll
        }
        Task {
            var results = TextResults()
            var first = true
            var selectionSet = false
            var showing = false
            var poll = await firstPoll.value
            while let current = poll, searchId == textSearchId, kind == .search {
                for batch in current.batches {
                    results = TextSearchModel.append(results, batch, folders: folders, first: first)
                    first = false
                }
                if !current.batches.isEmpty || current.done {
                    if showing || current.done || text.rows.isEmpty || results.rows.count >= Self.visibleRows {
                        showing = true
                        text = results
                    }
                    // The first rows of a new search take the selection; later batches keep it (FileSearch.svelte).
                    if showing && !selectionSet && !text.rows.isEmpty {
                        selectFirst()
                        selectionSet = true
                    }
                }
                if current.done {
                    textRunning = false
                    return
                }
                // Once the visible rows are filled, the rest comes in one go (up to 40 ms, or when the search ends):
                // each batch below them only moved the scrollbar, a redraw each.
                let args = TextPollArgs(searchId: searchId, waitMs: 50, gatherMs: showing ? 40 : 0)
                poll = await Task.detached { () -> TextSearchPoll? in
                    try? Backend.call("text_search_poll", args) as TextSearchPoll
                }.value
            }
            if searchId == textSearchId {
                textRunning = false
            }
        }
    }

    /// Rows the results list shows at once (at most 468 points of 26-point rows).
    static let visibleRows = 18
}

struct TextPollArgs: Encodable {
    let searchId: UInt64
    /// The bridge waits up to this long for the next batch.
    let waitMs: Int
    /// And this long for more batches once one is there.
    let gatherMs: Int
}

/// The batches a streamed search found since the last poll (bridge search.rs Poll).
struct TextSearchPoll: Decodable {
    let batches: [TextSearchBatch]
    let done: Bool
}

struct FileSearchProgress: Decodable {
    let indexed: Int
    let done: Bool
    let truncated: Bool
}

struct FileSearchResults: Decodable {
    let items: [FileSearchItem]
    let matched: Int
    let indexed: Int
    let done: Bool
    let truncated: Bool
}

struct FileQueryArgs: Encodable {
    let workspaceRoots: [String]
    let query: String
    let limit: Int
}

struct TextSearchArgs: Encodable {
    let workspaceRoots: [String]
    let searchId: UInt64
    let query: String
}
