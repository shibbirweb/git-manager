// Quick Open's pure logic (src/lib/quickOpen/quickOpenModel.ts): which mode the typed prefix picks, Go to Line, the
// rows of the files and commands modes, recent files matched against a query, and keyboard selection.

import Foundation

public enum QuickOpenMode: String, Sendable {
    case files
    case commands
    case line
    case symbols
    case workspaceSymbols
    case help
}

public struct QuickOpenPrefix: Sendable {
    public let prefix: String
    public let mode: QuickOpenMode
    public let label: String
}

public struct ParsedQuery: Equatable, Sendable {
    public let mode: QuickOpenMode
    public let prefix: String
    /// What follows the prefix, trimmed.
    public let text: String
}

/// One row of Quick Open: a section heading, a message, a file, a command or a prefix of the help.
public enum QuickRow: Equatable, Sendable {
    case header(key: String, label: String)
    case message(key: String, label: String)
    case file(key: String, file: SearchRow)
    case command(key: String, command: PaletteItem)
    case line(key: String, label: String, target: LineTarget?)
    case help(key: String, prefix: String, label: String)

    public var key: String {
        switch self {
        case .header(let key, _), .message(let key, _), .file(let key, _), .command(let key, _), .line(let key, _, _),
             .help(let key, _, _):
            return key
        }
    }

    public var isSelectable: Bool {
        switch self {
        case .header, .message:
            return false
        case .line(_, _, let target):
            return target != nil
        default:
            return true
        }
    }
}

public struct LineTarget: Equatable, Sendable {
    public let line: Int
    public let column: Int?
}

public enum QuickOpenModel {
    /// No prefix finds files; the others switch mode as soon as they are typed.
    public static let prefixes: [QuickOpenPrefix] = [
        QuickOpenPrefix(prefix: "", mode: .files, label: "Go to File"),
        QuickOpenPrefix(prefix: ">", mode: .commands, label: "Show and Run Commands"),
        QuickOpenPrefix(prefix: ":", mode: .line, label: "Go to Line"),
        QuickOpenPrefix(prefix: "@", mode: .symbols, label: "Go to Symbol in Editor"),
        QuickOpenPrefix(prefix: "#", mode: .workspaceSymbols, label: "Go to Symbol in Workspace"),
        QuickOpenPrefix(prefix: "?", mode: .help, label: "Help"),
    ]

    public static func parse(_ value: String) -> ParsedQuery {
        let first = value.unicodeScalars.first.map { String($0) } ?? ""
        if let known = prefixes.first(where: { !$0.prefix.isEmpty && $0.prefix == first }) {
            let rest = String(value.unicodeScalars.dropFirst())
            return ParsedQuery(mode: known.mode, prefix: known.prefix, text: Fuzzy.jsTrim(rest))
        }
        return ParsedQuery(mode: .files, prefix: "", text: Fuzzy.jsTrim(value))
    }

    public static func label(_ mode: QuickOpenMode) -> String {
        prefixes.first { $0.mode == mode }?.label ?? ""
    }

    /// Recently opened files: the file on screen goes last, so Cmd+P then Enter returns to the file before it.
    public static func recentOrder(_ filePaths: [String], activePath: String?) -> [String] {
        guard let activePath, filePaths.contains(activePath) else {
            return filePaths
        }
        return filePaths.filter { $0 != activePath } + [activePath]
    }

    /// A recent file row matched against `query` (its folder and name), highlighted; nil when it does not match.
    public static func matchRecentRow(_ row: SearchRow, _ query: String) -> (row: SearchRow, score: Double)? {
        let folder = row.folderParts.map(\.text).joined()
        let path = folder.isEmpty ? row.name : "\(folder)/\(row.name)"
        guard let match = Fuzzy.match(query, path) else {
            return nil
        }
        let nameStart = path.unicodeScalars.count - row.name.unicodeScalars.count
        var matched = row
        matched.nameParts = SearchRows.highlight(row.name, match.indices, nameStart)
        matched.folderParts = folder.isEmpty ? [] : SearchRows.highlight(folder, match.indices, 0)
        return (matched, match.score)
    }

    /// Recently opened files that match `query` (their folder and name), best first.
    public static func matchingRecent(_ rows: [SearchRow], _ query: String) -> [SearchRow] {
        if Fuzzy.jsTrim(query).isEmpty {
            return rows
        }
        let scored = rows.enumerated().compactMap { recency, row in
            matchRecentRow(row, query).map { (row: $0.row, score: $0.score, recency: recency) }
        }
        return scored.sorted { $0.score != $1.score ? $0.score > $1.score : $0.recency < $1.recency }.map(\.row)
    }

    public static func firstSelectable(_ rows: [QuickRow]) -> Int {
        max(0, rows.firstIndex { $0.isSelectable } ?? -1)
    }

    /// The row after a key, skipping headings: single steps wrap, page steps stop at the ends.
    public static func moveSelectable(_ rows: [QuickRow], selected: Int, step: Int) -> Int {
        let selectable = rows.indices.filter { rows[$0].isSelectable }
        if selectable.isEmpty {
            return selected
        }
        let position = selectable.firstIndex { $0 >= selected } ?? (selectable.count - 1)
        return selectable[SearchRows.moveSelection(position, count: selectable.count, step: step)]
    }

    /// Rows of the "?" mode: every prefix and what it does.
    public static func helpRows() -> [QuickRow] {
        prefixes.map { .help(key: "help:\($0.mode.rawValue)", prefix: $0.prefix, label: $0.label) }
    }

    /// The palette's rows, under "Recently used" and "Other commands" headings.
    public static func commandRows(recent: [PaletteItem], other: [PaletteItem]) -> [QuickRow] {
        var rows: [QuickRow] = []
        if !recent.isEmpty {
            rows.append(.header(key: "h:recent", label: "Recently used"))
            rows += recent.map { .command(key: "r:\($0.key)", command: $0) }
            if !other.isEmpty {
                rows.append(.header(key: "h:other", label: "Other commands"))
            }
        }
        return rows + other.map { .command(key: "c:\($0.key)", command: $0) }
    }

    /// Files mode: matching recent files first, then the other results without repeating them.
    public static func fileRows(recent: [SearchRow], results: [SearchRow], hasQuery: Bool) -> [QuickRow] {
        var rows: [QuickRow] = []
        var shown = Set<String>()
        if !recent.isEmpty {
            rows.append(.header(key: "h:recent", label: "Recently opened"))
            for file in recent {
                shown.insert(file.path)
                rows.append(.file(key: "r:\(file.path)", file: file))
            }
        }
        let rest = results.filter { !shown.contains($0.path) }
        if hasQuery && !rest.isEmpty {
            if !rows.isEmpty {
                rows.append(.header(key: "h:files", label: "File results"))
            }
            rows += rest.map { .file(key: "f:\($0.path)", file: $0) }
        }
        return rows
    }

    /// ":120", ":120:5" and ":120,5", without the colon; nil for anything else.
    public static func parseGoToLine(_ text: String) -> LineTarget? {
        let pattern = #"^\s*(\d+)\s*(?:[:,]\s*(\d*)\s*)?$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let found = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let lineRange = Range(found.range(at: 1), in: text), let line = Int(text[lineRange]) else {
            return nil
        }
        let columnRange = Range(found.range(at: 2), in: text)
        let column = columnRange.flatMap { text[$0].isEmpty ? nil : Int(text[$0]) }
        return LineTarget(line: max(1, line), column: column.map { max(1, $0) })
    }

    /// Every rows the files mode shows for `query` (Quick Open's message rows included).
    public static func filesModeRows(
        query: String, recent: [SearchRow], results: [SearchRow], indexing: Bool, hasFolder: Bool
    ) -> [QuickRow] {
        if !hasFolder {
            return [.message(key: "message", label: "Open a folder to search its files, or type > for commands")]
        }
        let text = SearchRows.splitLocation(query).text
        let shown = fileRows(recent: matchingRecent(recent, text), results: text.isEmpty ? [] : results,
                             hasQuery: !text.isEmpty)
        if !shown.isEmpty {
            return shown
        }
        if text.isEmpty {
            return [.message(key: "message", label: "No recent files. Type to search files by name.")]
        }
        return [.message(key: "message", label: indexing ? "Indexing..." : "No files match")]
    }
}
