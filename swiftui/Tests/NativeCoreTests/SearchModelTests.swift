// Quick Open's and Find in Files' logic against the current app's TypeScript. Fixtures/search-*.txt hold cases run
// through src/lib/commands/fuzzy.ts and src/lib/quickOpen/quickOpenModel.ts (make-search-fixtures.ts); the rest are
// the TypeScript tests' own cases.

import Foundation
@testable import NativeCore
import Testing

private func fixtureLines(_ name: String) throws -> [[String]] {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/\(name)")
    return try String(contentsOf: url, encoding: .utf8).split(separator: "\n").map {
        $0.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    }
}

private func decoded(_ json: String) throws -> String {
    try JSONDecoder().decode(String.self, from: Data(json.utf8))
}

@Test(arguments: ["search-fuzzy-1.txt", "search-fuzzy-2.txt", "search-fuzzy-3.txt", "search-fuzzy-4.txt"])
func fuzzyMatchesTypeScript(_ fixture: String) throws {
    for parts in try fixtureLines(fixture) {
        let query = try decoded(parts[0])
        let target = try decoded(parts[1])
        let match = Fuzzy.match(query, target)
        if parts[2] == "null" {
            #expect(match == nil, "\(query) in \(target)")
            continue
        }
        let indices = parts[3].isEmpty ? [] : parts[3].split(separator: ",").compactMap { Int($0) }
        #expect(match?.score == Double(parts[2]), "score of \(query) in \(target)")
        #expect(match?.indices == indices, "indices of \(query) in \(target)")
    }
}

@Test func recentFilesMatchTypeScript() throws {
    let root = "/work/acme/storefront"
    let files = ["src/cart.ts", "src/pricing.ts", "README.md", "docs/cart-api.md", "src/checkout.ts", "src/index.ts"]
    let rows = SearchRows.pathRows(files.map { "\(root)/\($0)" }, [FolderRef(root: root, name: "storefront")])
    for parts in try fixtureLines("search-recent-1.txt") {
        let shown = QuickOpenModel.matchingRecent(rows, try decoded(parts[0])).map { row in
            (row.folderParts + [TextPart(text: "|", match: false)] + row.nameParts)
                .map { $0.match ? "[\($0.text)]" : $0.text }.joined()
        }
        #expect(shown.joined(separator: " ") == parts[1], "recent files for \(parts[0])")
    }
}

@Test func quickOpenParsesPrefixes() {
    #expect(QuickOpenModel.parse("> git ") == ParsedQuery(mode: .commands, prefix: ">", text: "git"))
    #expect(QuickOpenModel.parse(":12") == ParsedQuery(mode: .line, prefix: ":", text: "12"))
    #expect(QuickOpenModel.parse(" cart ") == ParsedQuery(mode: .files, prefix: "", text: "cart"))
    #expect(QuickOpenModel.parse("?") == ParsedQuery(mode: .help, prefix: "?", text: ""))
    #expect(QuickOpenModel.parseGoToLine("120:5") == LineTarget(line: 120, column: 5))
    #expect(QuickOpenModel.parseGoToLine("0,") == LineTarget(line: 1, column: nil))
    #expect(QuickOpenModel.parseGoToLine("12a") == nil)
}

@Test func splitsLocations() {
    let split = SearchRows.splitLocation(" cart.ts:12:5 ")
    #expect(split.text == "cart.ts" && split.line == 12 && split.column == 5)
    let unfinished = SearchRows.splitLocation("cart:")
    #expect(unfinished.text == "cart" && unfinished.line == nil)
    let three = SearchRows.splitLocation("a:1:2:3")
    #expect(three.text == "a:1" && three.line == 2 && three.column == 3)
}

@Test func highlightsByCodePoint() {
    let parts = SearchRows.highlight("café.ts", [3, 4, 9], 1)
    #expect(parts == [TextPart(text: "ca", match: false), TextPart(text: "fé", match: true),
                      TextPart(text: ".ts", match: false)])
    let row = SearchRows.resultRows(
        [FileSearchItem(path: "/r/src/cart.ts", root: "/r", relativePath: "src/cart.ts", indices: [0, 4])],
        [FolderRef(root: "/r", name: "r")]
    )[0]
    #expect(row.name == "cart.ts" && row.nameParts.first == TextPart(text: "c", match: true))
    #expect(row.folderParts == [TextPart(text: "s", match: true), TextPart(text: "rc", match: false)])
}

@Test func fileRowsHeadRecentFiles() {
    let recent = SearchRows.pathRows(["/r/a.ts"], [FolderRef(root: "/r", name: "r")])
    let results = SearchRows.pathRows(["/r/a.ts", "/r/b.ts"], [FolderRef(root: "/r", name: "r")])
    let rows = QuickOpenModel.fileRows(recent: recent, results: results, hasQuery: true)
    #expect(rows.map(\.key) == ["h:recent", "r:/r/a.ts", "h:files", "f:/r/b.ts"])
    #expect(QuickOpenModel.firstSelectable(rows) == 1)
    #expect(QuickOpenModel.moveSelectable(rows, selected: 1, step: 1) == 3)
    #expect(QuickOpenModel.moveSelectable(rows, selected: 3, step: 1) == 1)
    let empty = QuickOpenModel.filesModeRows(query: "", recent: [], results: [], indexing: false, hasFolder: true)
    #expect(empty == [.message(key: "message", label: "No recent files. Type to search files by name.")])
}

@Test func textResultsFlattenBatches() throws {
    let json = """
        {"files":[{"path":"/r/src/cart.ts","root":"/r","relativePath":"src/cart.ts","lines":[
        {"line":10,"column":11,"text":"private lines: 😀lines","ranges":[[8,13],[17,22]]}]}],
        "done":true,"matches":2,"filesMatched":1,"filesSearched":13,"more":false,"error":null}
        """
    let batch = try JSONDecoder().decode(TextSearchBatch.self, from: Data(json.utf8))
    let results = TextSearchModel.append(TextResults(), batch, folders: [FolderRef(root: "/r", name: "r")], first: true)
    #expect(results.rows.count == 2)
    #expect(results.rows[0] == .file(key: "tf:/r/src/cart.ts", path: "/r/src/cart.ts", name: "cart.ts",
                                     folder: "src", count: 1))
    guard case .line(_, _, 10, 11, let parts) = results.rows[1] else {
        Issue.record("no line row")
        return
    }
    #expect(parts.map(\.text) == ["private ", "lines", ": 😀", "lines"])
    #expect(TextSearchModel.status(results, running: false) == "2 matches in 1 file")
    #expect(TextSearchModel.status(results, running: true) == "Searching... 2 matches in 1 file")
    #expect(SearchRows.countLabel(12_345, "file") == "12,345 files")
}

@Test func virtualListRanges() {
    #expect(PopupRows.visibleRange(scrollTop: 0, viewportHeight: 468, rowHeight: 26, count: 180) == 0..<25)
    #expect(PopupRows.visibleRange(scrollTop: 260, viewportHeight: 468, rowHeight: 26, count: 20) == 4..<20)
    #expect(PopupRows.scrollToShow(index: 20, scrollTop: 0, viewportHeight: 460, rowHeight: 26, firstIndex: 0) == 86)
    #expect(PopupRows.scrollToShow(index: 1, scrollTop: 50, viewportHeight: 460, rowHeight: 26, firstIndex: 1) == 0)
}

@Test func paletteListsLikeTheRegistry() {
    let commands = [
        PaletteCommand(id: "b", title: "Push", category: "Git", shortcut: nil, enabled: false, checked: nil,
                       reason: "Needs a Git repository", order: 1),
        PaletteCommand(id: "a", title: "Fetch", category: "Git", shortcut: "⌘F", enabled: true, checked: nil,
                       reason: nil, order: 0),
        PaletteCommand(id: "c", title: "Settings", category: "App", shortcut: nil, enabled: true, checked: nil,
                       reason: nil, order: 2),
    ]
    let empty = Palette.list(commands, query: "", recent: ["c"])
    #expect(empty.recent.map(\.key) == ["c"] && empty.other.map(\.key) == ["a", "b"])
    let rows = QuickOpenModel.commandRows(recent: empty.recent, other: empty.other)
    #expect(rows.map(\.key) == ["h:recent", "r:c", "h:other", "c:a", "c:b"])
    let push = Palette.list(commands, query: "push git", recent: [])
    #expect(push.other.map(\.key) == ["b"])
    #expect(push.other[0].titleParts == [TextPart(text: "Push", match: true)])
    #expect(push.other[0].categoryParts == [TextPart(text: "Git", match: true)])
}
