// Find in Files' results (src/lib/search/textSearchModel.ts): the backend's batches flattened into file and line
// rows with the matches highlighted, and the Text tab's status line. Match ranges are UTF-16 offsets, as the
// backend sends them.

import Foundation

/// One batch of text_search, as the backend sends it (src-tauri/src/text_search.rs TextSearchBatch).
public struct TextSearchBatch: Decodable, Sendable {
    public struct LineMatch: Decodable, Sendable {
        public let line: Int
        public let column: Int
        public let text: String
        public let ranges: [[Int]]?

        public init(line: Int, column: Int, text: String, ranges: [[Int]]?) {
            self.line = line
            self.column = column
            self.text = text
            self.ranges = ranges
        }
    }

    public struct FileMatches: Decodable, Sendable {
        public let path: String
        public let root: String
        public let relativePath: String
        public let lines: [LineMatch]?

        public init(path: String, root: String, relativePath: String, lines: [LineMatch]?) {
            self.path = path
            self.root = root
            self.relativePath = relativePath
            self.lines = lines
        }
    }

    public let files: [FileMatches]?
    public let done: Bool
    public let matches: Int
    public let filesMatched: Int
    public let filesSearched: Int
    public let more: Bool
    public let error: String?
}

public enum TextRow: Equatable, Sendable {
    /// A file heading its matches; not selectable.
    case file(key: String, path: String, name: String, folder: String, count: Int)
    case line(key: String, path: String, line: Int, column: Int, parts: [TextPart])

    public var key: String {
        switch self {
        case .file(let key, _, _, _, _), .line(let key, _, _, _, _):
            return key
        }
    }
}

public struct TextResults: Equatable, Sendable {
    public var rows: [TextRow] = []
    public var matches = 0
    public var filesMatched = 0
    public var filesSearched = 0
    public var more = false
    public var done = true
    public var error: String?

    public init() {}
}

public enum TextSearchModel {
    /// Fewer characters match nearly every line; the backend ignores them too.
    public static let minQuery = 2

    /// Whether `query` is long enough to search (code points, like the backend).
    public static func searchable(_ query: String) -> Bool {
        query.unicodeScalars.count >= minQuery
    }

    /// Splits `text` at UTF-16 `ranges` (sorted, from the backend) into matched and plain runs.
    public static func rangeParts(_ text: String, _ ranges: [[Int]]) -> [TextPart] {
        let units = Array(text.utf16)
        let slice = { (from: Int, to: Int) in String(decoding: units[from..<to], as: UTF16.self) }
        var parts: [TextPart] = []
        var position = 0
        for range in ranges where range.count == 2 {
            let from = max(range[0], position)
            let to = min(range[1], units.count)
            if to <= from {
                continue
            }
            if from > position {
                parts.append(TextPart(text: slice(position, from), match: false))
            }
            parts.append(TextPart(text: slice(from, to), match: true))
            position = to
        }
        if position < units.count {
            parts.append(TextPart(text: slice(position, units.count), match: false))
        }
        return parts
    }

    /// The results with `batch` added; `first` starts over (the first batch of a new search).
    public static func append(
        _ results: TextResults, _ batch: TextSearchBatch, folders: [FolderRef], first: Bool
    ) -> TextResults {
        let several = folders.count > 1
        var rows = first ? [] : results.rows
        // Each file comes once per search; a repeat would break the keyed list.
        var seen = Set(rows.compactMap { row -> String? in
            if case .file(_, let path, _, _, _) = row {
                return path
            }
            return nil
        })
        for file in batch.files ?? [] where !seen.contains(file.path) {
            seen.insert(file.path)
            let scalars = Array(file.relativePath.unicodeScalars)
            let slash = scalars.lastIndex(of: "/")
            let dir = slash.map { SearchRows.string(scalars[..<$0]) } ?? ""
            let name = SearchRows.string(scalars[(slash.map { $0 + 1 } ?? 0)...])
            let folderName = several ? folders.first { $0.root == file.root }?.name : nil
            let folder = folderName.map { dir.isEmpty ? $0 : "\($0)/\(dir)" } ?? dir
            let lines = file.lines ?? []
            rows.append(.file(key: "tf:\(file.path)", path: file.path, name: name, folder: folder, count: lines.count))
            for line in lines {
                rows.append(.line(
                    key: "tl:\(file.path):\(line.line)", path: file.path, line: line.line, column: line.column,
                    parts: rangeParts(line.text, line.ranges ?? [])
                ))
            }
        }
        var next = TextResults()
        next.rows = rows
        next.matches = batch.matches
        next.filesMatched = batch.filesMatched
        next.filesSearched = batch.filesSearched
        next.more = batch.more
        next.done = batch.done
        next.error = batch.error
        return next
    }

    /// The status line of the Text tab.
    public static func status(_ results: TextResults, running: Bool) -> String {
        if let error = results.error {
            return error
        }
        let files = SearchRows.countLabel(results.filesMatched, "file")
        let matches = SearchRows.countLabel(results.matches, "match")
        if running {
            return results.matches > 0 ? "Searching... \(matches) in \(files)" : "Searching..."
        }
        if results.more {
            return "Showing the first \(matches) in \(files)"
        }
        return results.matches > 0 ? "\(matches) in \(files)" : ""
    }

    /// The Text tab's line when it has no rows.
    public static func emptyText(query: String, results: TextResults, running: Bool) -> String {
        if !searchable(query) {
            return "Type at least 2 characters to search file contents"
        }
        if let error = results.error {
            return error
        }
        return running ? "Searching..." : "No matches"
    }
}

public enum PopupRows {
    /// Rows a virtual list renders: what fits in the viewport plus `overscan` on each side.
    public static func visibleRange(
        scrollTop: Double, viewportHeight: Double, rowHeight: Double, count: Int, overscan: Int = 6
    ) -> Range<Int> {
        let first = Int((max(0, scrollTop) / rowHeight).rounded(.down))
        // Before the first layout the viewport is unknown: render one screenful.
        let visible = Int(((viewportHeight > 0 ? viewportHeight : rowHeight * 16) / rowHeight).rounded(.up)) + 1
        let start = min(count, max(0, first - overscan))
        let end = min(count, first + visible + overscan)
        return start..<max(start, end)
    }

    /// The scroll position that shows row `index`, or `scrollTop` when it already shows. Selecting the first
    /// selectable row scrolls to the top so its heading shows too.
    public static func scrollToShow(
        index: Int, scrollTop: Double, viewportHeight: Double, rowHeight: Double, firstIndex: Int
    ) -> Double {
        if index <= firstIndex {
            return 0
        }
        let top = Double(index) * rowHeight
        if top < scrollTop {
            return top
        }
        if viewportHeight > 0 && top + rowHeight > scrollTop + viewportHeight {
            return top + rowHeight - viewportHeight
        }
        return scrollTop
    }
}
