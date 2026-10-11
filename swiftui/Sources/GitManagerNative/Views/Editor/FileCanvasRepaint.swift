// What of the file canvas a change paints again (FileCanvas.content): a whole repaint costs 11 to 14 ms, enough to
// make Find Next or a click slower than the page, so a change of the selection alone paints only the rows it
// changes, and a new find search only the boxes of the matches that change (WebKit repaints just those too).

import AppKit
import NativeCore

extension FileCanvas {
    /// Rows to paint again for a change from `old` to `new` (nil: every row on screen). For a selection change: the
    /// rows the old and the new selections and cursors cover (the selection boxes, the active line, the cursor
    /// line's blame note, the find bar's selected match) and the matching brackets; and the boxes of the word,
    /// selection and find match tints that come, go or change.
    func repaintRows(from old: Content?, to new: Content?) -> (rows: IndexSet, boxes: [DirtyBox])? {
        guard let old, let new, old.path == new.path, old.docRevision == new.docRevision,
              old.paintRevision == new.paintRevision, old.theme.id == new.theme.id, old.focused == new.focused,
              old.blinking == new.blinking, old.geometry == new.geometry,
              old.language == new.language, old.indentSize == new.indentSize else {
            return nil
        }
        // Another blame note only changes the cursor rows, unless it changes what scrolls sideways.
        if old.blameLabel != new.blameLabel {
            let width = visibleWidth
            guard old.geometry.scrollsSideways(visibleWidth: width, noteEnd: noteEnd(old))
                    == new.geometry.scrollsSideways(visibleWidth: width, noteEnd: noteEnd(new)) else {
                return nil
            }
        }
        var rows = IndexSet()
        for content in [old, new] {
            // A snippet's fields: their rows (tinted or marked) come and go with the snippet.
            if old.snippetFields != new.snippetFields {
                for field in content.snippetFields ?? [] {
                    rows.insert(integersIn: row(of: field.from, content)...row(of: field.to, content))
                }
            }
            for range in content.state.selection.ranges {
                rows.insert(integersIn: row(of: range.from, content)...row(of: range.to, content))
            }
            for match in BracketMatch.matches(content.state) {
                for range in [match.start] + (match.end.map { [$0] } ?? []) {
                    rows.insert(row(of: range.lowerBound, content))
                }
            }
        }
        // The boxes of the word or selection match tints and of the find matches that come, go or change length,
        // with the 1-point outline and a point of glyph overhang on each side; a match across lines takes its rows.
        var changed = Set(matchRanges(old).map(\.1)).symmetricDifference(matchRanges(new).map(\.1))
        if old.findQuery != new.findQuery, let span = visibleSpan(new) {
            let before = Set(old.findQuery?.matches(in: old.doc, from: span.lowerBound, to: span.upperBound) ?? [])
            let after = Set(new.findQuery?.matches(in: new.doc, from: span.lowerBound, to: span.upperBound) ?? [])
            changed.formUnion(before.symmetricDifference(after))
        }
        var boxes: [DirtyBox] = []
        for range in changed {
            let first = row(of: range.lowerBound, new), last = row(of: range.upperBound, new)
            if first != last {
                rows.insert(integersIn: first...last)
                continue
            }
            boxes.append(DirtyBox(row: first, from: x(of: range.lowerBound, row: first, new) - 2,
                                  to: x(of: range.upperBound, row: first, new) + 2))
        }
        return (rows, boxes)
    }
}

extension FileCanvas {
    /// The document offsets of the rows on screen.
    func visibleSpan(_ content: Content) -> Range<Int>? {
        let visible = rows(content, from: 0, to: bounds.height, spill: 0)
        guard !visible.isEmpty else {
            return nil
        }
        let first = content.layout.lines(forRow: visible.lowerBound).lowerBound
        let last = content.layout.lines(forRow: visible.upperBound - 1).upperBound
        let doc = content.doc
        return doc.line(first).from..<doc.line(min(last, doc.lineCount - 1)).to
    }
}

/// A part of a row to paint again, from and to in the row's text coordinates (FileCanvas.x(of:row:_:)).
struct DirtyBox {
    let row: Int
    let from: CGFloat
    let to: CGFloat
}

extension FileCanvas {
    /// Whether the content layer's pixels, as the partial repaints left them, equal a whole repaint of the same
    /// state (the smoke test's check of the dirty rows and boxes). Paints what is pending first.
    func paintsLikeWhole() -> Bool {
        paintLayers()
        let before = surface.pixels()
        dirtyRows = nil
        paintLayers()
        return before != nil && before == surface.pixels()
    }
}
