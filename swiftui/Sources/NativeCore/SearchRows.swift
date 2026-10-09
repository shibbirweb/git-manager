// The file rows of Quick Open and Search Everywhere (src/lib/search/fileSearchModel.ts and countLabel.ts): match
// highlighting, rows for search results and recent files, Recent Files' order, keyboard steps and the ":LINE"
// suffix of a query. Positions are code points, as the backend and the TypeScript count them.

import Foundation

public struct TextPart: Equatable, Sendable {
    public var text: String
    public var match: Bool

    public init(text: String, match: Bool) {
        self.text = text
        self.match = match
    }
}

public struct SearchRow: Equatable, Sendable {
    /// Absolute path; also the row key.
    public let path: String
    public let name: String
    public var nameParts: [TextPart]
    /// Folder below the workspace folder, led by that folder's name when there are several.
    public var folderParts: [TextPart]
}

/// A workspace folder: its absolute root and its name.
public struct FolderRef: Equatable, Sendable {
    public let root: String
    public let name: String

    public init(root: String, name: String) {
        self.root = root
        self.name = name
    }
}

/// One Go to File result from the backend (file_search_query).
public struct FileSearchItem: Decodable, Equatable, Sendable {
    public let path: String
    public let root: String
    public let relativePath: String
    public let indices: [Int]

    public init(path: String, root: String, relativePath: String, indices: [Int]) {
        self.path = path
        self.root = root
        self.relativePath = relativePath
        self.indices = indices
    }
}

public enum SearchRows {
    public static let recentLimit = 50

    /// Splits `text` into matched and unmatched runs. `indices` are code point positions in the whole relative path;
    /// `text` starts at code point `offset`.
    public static func highlight(_ text: String, _ indices: [Int], _ offset: Int) -> [TextPart] {
        let matched = Set(indices)
        var parts: [TextPart] = []
        var position = offset
        for scalar in text.unicodeScalars {
            let match = matched.contains(position)
            if let last = parts.indices.last, parts[last].match == match {
                parts[last].text.unicodeScalars.append(scalar)
            } else {
                parts.append(TextPart(text: String(scalar), match: match))
            }
            position += 1
        }
        return parts
    }

    static func row(path: String, relativePath: String, folderName: String?, indices: [Int]) -> SearchRow {
        let scalars = Array(relativePath.unicodeScalars)
        let slash = scalars.lastIndex(of: "/")
        let dir = slash.map { string(scalars[..<$0]) } ?? ""
        let name = string(scalars[(slash.map { $0 + 1 } ?? 0)...])
        let nameOffset = slash.map { $0 + 1 } ?? 0
        var folderParts = highlight(dir, indices, 0)
        if let folderName {
            folderParts.insert(TextPart(text: dir.isEmpty ? folderName : "\(folderName)/", match: false), at: 0)
        }
        return SearchRow(
            path: path, name: name, nameParts: highlight(name, indices, nameOffset), folderParts: folderParts
        )
    }

    /// Rows for search results; the folder name leads only in a multi-folder workspace.
    public static func resultRows(_ items: [FileSearchItem], _ folders: [FolderRef]) -> [SearchRow] {
        let several = folders.count > 1
        return items.map { item in
            let folderName = several ? folders.first { $0.root == item.root }?.name : nil
            return row(path: item.path, relativePath: item.relativePath, folderName: folderName, indices: item.indices)
        }
    }

    /// Rows for absolute paths (Recent Files); paths outside every folder are left out.
    public static func pathRows(_ paths: [String], _ folders: [FolderRef]) -> [SearchRow] {
        let several = folders.count > 1
        return paths.compactMap { path in
            guard let folder = folderFor(folders, path), folder.root != path else {
                return nil
            }
            return row(path: path, relativePath: relativeTo(folder.root, path), folderName: several ? folder.name : nil,
                       indices: [])
        }
    }

    /// The deepest workspace folder holding `absolutePath`.
    public static func folderFor(_ folders: [FolderRef], _ absolutePath: String) -> FolderRef? {
        var best: FolderRef?
        for folder in folders where isInside(folder.root, absolutePath) {
            if best == nil || folder.root.utf16.count > (best?.root.utf16.count ?? 0) {
                best = folder
            }
        }
        return best
    }

    static func isInside(_ root: String, _ absolutePath: String) -> Bool {
        if absolutePath == root {
            return true
        }
        let prefix = root.hasSuffix("/") ? root : root + "/"
        return absolutePath.hasPrefix(prefix)
    }

    public static func relativeTo(_ root: String, _ absolutePath: String) -> String {
        if absolutePath == root {
            return ""
        }
        let drop = root.hasSuffix("/") ? root.utf16.count : root.utf16.count + 1
        return String(absolutePath.utf16.dropFirst(drop)) ?? ""
    }

    /// Recent Files: the active tab, then the Recent Files list (most recent first), then the other open tabs.
    public static func recentFiles(
        activePath: String?, recentPaths: [String], tabPaths: [String], limit: Int = recentLimit
    ) -> [String] {
        var seen: [String] = []
        for path in [activePath] + recentPaths.map(Optional.some) + tabPaths.map(Optional.some) {
            if let path, !path.isEmpty, !seen.contains(path) {
                seen.append(path)
            }
            if seen.count >= limit {
                break
            }
        }
        return seen
    }

    /// The row to select after a key: single steps wrap around the ends, page steps stop at them.
    public static func moveSelection(_ selected: Int, count: Int, step: Int) -> Int {
        if count == 0 {
            return 0
        }
        if abs(step) == 1 {
            return (selected + step + count) % count
        }
        return max(0, min(count - 1, selected + step))
    }

    /// Splits a trailing ":LINE" or ":LINE:COL" off a query, like the backend. An unfinished trailing ":" is dropped.
    public static func splitLocation(_ query: String) -> (text: String, line: Int?, column: Int?) {
        var text = Fuzzy.jsTrim(query)
        if text.hasSuffix(":") {
            text.removeLast()
        }
        var numbers: [Int] = []
        while numbers.count < 2 {
            guard let range = text.range(of: #":(\d+)$"#, options: .regularExpression),
                  let number = Int(text[range].dropFirst()) else {
                break
            }
            numbers.insert(number, at: 0)
            text = String(text[..<range.lowerBound])
        }
        return (Fuzzy.jsTrim(text), numbers.first, numbers.count > 1 ? numbers[1] : nil)
    }

    /// "1 file", "2 classes", "0 matches" (countLabel.ts), with thousands separators as toLocaleString writes them.
    public static func countLabel(_ count: Int, _ word: String) -> String {
        let plurals = ["file": "files", "class": "classes", "symbol": "symbols", "match": "matches"]
        return "\(grouped(count)) \(count == 1 ? word : plurals[word] ?? word + "s")"
    }

    /// 12,345 (en-US grouping).
    public static func grouped(_ count: Int) -> String {
        let digits = String(abs(count))
        var out = ""
        for (offset, digit) in digits.enumerated() {
            if offset > 0 && (digits.count - offset) % 3 == 0 {
                out.append(",")
            }
            out.append(digit)
        }
        return count < 0 ? "-" + out : out
    }

    static func string(_ scalars: ArraySlice<Unicode.Scalar>) -> String {
        var view = String.UnicodeScalarView()
        view.append(contentsOf: scalars)
        return String(view)
    }
}
