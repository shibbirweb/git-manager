// The character diff against CodeMirror itself. Fixtures/cm-diff-*.txt hold random cases run through
// @codemirror/merge 6.12.2 (diff, presentableDiff and Chunk.build), one per line: a, b, diff, presentable, chunks.

import Foundation
@testable import NativeCore
import Testing

private struct Case {
    let a: String
    let b: String
    let diff: String
    let presentable: String
    let chunks: String
}

private func cases(_ name: String) throws -> [Case] {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/\(name)")
    return try String(contentsOf: url, encoding: .utf8).split(separator: "\n").map { line in
        let parts = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
        let decode = { (text: String) in
            try JSONDecoder().decode(String.self, from: Data(text.utf8))
        }
        return Case(a: try decode(parts[0]), b: try decode(parts[1]), diff: parts[2], presentable: parts[3],
                    chunks: parts[4])
    }
}

private func format(_ changes: [CharChange]) -> String {
    changes.map { "\($0.fromA),\($0.toA),\($0.fromB),\($0.toB)" }.joined(separator: ";")
}

@Test(arguments: ["cm-diff-1.txt", "cm-diff-2.txt"])
func charDiffMatchesCodeMirror(_ fixture: String) throws {
    for item in try cases(fixture) {
        let a = Array(item.a.utf16), b = Array(item.b.utf16)
        let changes = CharDiff.diff(a, b, scanLimit: 1_000_000_000 << 1)
        #expect(format(changes) == item.diff, "diff of \(item.a.debugDescription) and \(item.b.debugDescription)")
        var presentable = changes
        Presentable.apply(&presentable, a, b)
        #expect(format(presentable) == item.presentable, "presentable \(item.a.debugDescription)")
        let chunks = DiffChunks.toChunks(presentable, LineTable(a), LineTable(b))
            .map { "\($0.fromA),\($0.toA),\($0.fromB),\($0.toB):\(format($0.changes))" }
            .joined(separator: "|")
        #expect(chunks == item.chunks, "chunks \(item.a.debugDescription) and \(item.b.debugDescription)")
    }
}
