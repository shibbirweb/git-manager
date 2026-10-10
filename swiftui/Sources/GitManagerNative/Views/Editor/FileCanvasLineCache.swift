// The Core Text lines of the rows the file canvas painted lately: typesetting a row is about half of drawing it, and
// a cursor move, Find Next or a typed search repaints rows whose text did not change. Kept for the text, syntax
// colors and theme they were made for (dropped when any of them changes) and to a few screens of rows.

import AppKit
import NativeCore

struct LineCache {
    struct Generation: Equatable {
        var path = ""
        var doc = -1
        var paint = -1
        var theme = ""
    }

    var generation = Generation()
    /// By the text segment's range and its first column (tabs expand from it): the line and its width in columns.
    var lines: [SIMD3<Int>: (line: CTLine?, width: Int)] = [:]
    static let limit = 600
}

extension FileCanvas {
    /// The line of the text from `from` to `to` starting at `column`, made by `expand` (the text with its tabs
    /// expanded and its syntax spans) when it is not cached.
    func cachedLine(_ content: Content, from: Int, to: Int, column: Int, colors: CanvasColors,
                    expand: () -> (String, [SyntaxSpans.Span])) -> (line: CTLine?, width: Int) {
        let generation = LineCache.Generation(path: content.path, doc: content.docRevision,
                                              paint: content.paintRevision, theme: content.theme.id)
        if lineCache.generation != generation || lineCache.lines.count >= LineCache.limit {
            lineCache = LineCache(generation: generation)
        }
        let key = SIMD3(from, to, column)
        if let cached = lineCache.lines[key] {
            return cached
        }
        let (text, spans) = expand()
        let entry = (line: text.isEmpty ? nil : CodeLineText.line(text, spans: spans, colors: colors),
                     width: text.utf16.count)
        lineCache.lines[key] = entry
        return entry
    }
}
