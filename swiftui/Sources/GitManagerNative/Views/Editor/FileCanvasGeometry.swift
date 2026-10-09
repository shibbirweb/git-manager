// Where text sits in the file canvas: a row is a line, or a folded block drawn as the first line's text up to the
// fold, the placeholder, then the text after it. Columns are character cells (a tab runs to the next tab stop, as
// CodeMirror sets tab-size), so a position's x and the position under a point are arithmetic, no text measuring.

import AppKit
import NativeCore

extension FileCanvas {
    enum Segment: Equatable {
        case text(from: Int, to: Int)
        case placeholder(CodeFold)
    }

    /// .cm-foldPlaceholder as the current app draws it: CodeMirror's own style (its theme rule in features.ts does
    /// not take effect there, measured), "…" with 1 point of padding, a 1-point border and 1 point of margin a side.
    static let placeholderText = "…"
    static let placeholderWidth: CGFloat = {
        let ellipsis = CTLineCreateWithAttributedString(NSAttributedString(string: placeholderText, attributes: [
            .font: CodeFonts.shared.regular,
        ]))
        return 2 * (1 + 1 + 1) + CGFloat(CTLineGetTypographicBounds(ellipsis, nil, nil, nil))
    }()

    func segments(_ content: Content, row: Int) -> [Segment] {
        let lines = content.layout.lines(forRow: row)
        let first = content.doc.line(lines.lowerBound)
        guard let group = content.layout.group(forLine: first.index) else {
            return [.text(from: first.from, to: first.to)]
        }
        var result: [Segment] = []
        var cursor = first.from
        for fold in group.folds {
            result.append(.text(from: cursor, to: fold.from))
            result.append(.placeholder(fold))
            cursor = fold.to
        }
        result.append(.text(from: cursor, to: content.doc.line(lines.upperBound).to))
        return result
    }

    /// The width of `text` from column `start` in cells, tabs to the next stop.
    func cells(_ text: String, startColumn: Int, tabSize: Int) -> Int {
        var column = startColumn
        for unit in text.utf16 {
            column += unit == 9 ? tabSize - column % tabSize : 1
        }
        return column - startColumn
    }

    /// x of `position` (in `row`) from the text's left edge.
    func x(of position: Int, row: Int, _ content: Content) -> CGFloat {
        let tabSize = content.state.config.tabSize
        var x: CGFloat = 0, column = 0
        for segment in segments(content, row: row) {
            switch segment {
            case .text(let from, let to):
                let end = min(max(position, from), to)
                let width = cells(content.doc.slice(from, end), startColumn: column, tabSize: tabSize)
                if position <= to {
                    return x + CGFloat(width) * CodeLineText.advance
                }
                let all = cells(content.doc.slice(from, to), startColumn: column, tabSize: tabSize)
                column += all
                x += CGFloat(all) * CodeLineText.advance
            case .placeholder(let fold):
                if position <= fold.from {
                    return x
                }
                x += Self.placeholderWidth
            }
        }
        return x
    }

    /// The row's text width (to its end) from the text's left edge.
    func rowWidth(_ content: Content, row: Int) -> CGFloat {
        let lines = content.layout.lines(forRow: row)
        return x(of: content.doc.line(lines.upperBound).to, row: row, content)
    }

    /// The position nearest canvas point `point` (posAtCoords), and the character under it (for word and line
    /// clicks, which take the character's side).
    func position(at point: NSPoint) -> (position: Int, inside: Int)? {
        guard let content else {
            return nil
        }
        let row = self.row(at: point.y, content)
        var goal = point.x - textX(content)
        let tabSize = content.state.config.tabSize
        var column = 0
        let parts = segments(content, row: row)
        for (index, segment) in parts.enumerated() {
            switch segment {
            case .text(let from, let to):
                let text = Array(content.doc.slice(from, to).utf16)
                var offset = 0
                while offset < text.count {
                    let width = CGFloat(text[offset] == 9 ? tabSize - column % tabSize : 1) * CodeLineText.advance
                    if goal < width {
                        let position = from + offset
                        return (goal < width / 2 ? position : position + 1, position)
                    }
                    goal -= width
                    column += text[offset] == 9 ? tabSize - column % tabSize : 1
                    offset += 1
                }
                if index == parts.count - 1 || goal < 0 {
                    return (to, max(from, to - 1))
                }
            case .placeholder(let fold):
                if goal < Self.placeholderWidth {
                    return (goal < Self.placeholderWidth / 2 ? fold.from : fold.to, fold.from)
                }
                goal -= Self.placeholderWidth
            }
        }
        let last = content.doc.line(content.layout.lines(forRow: row).upperBound)
        return (last.to, max(last.from, last.to - 1))
    }

    /// The row holding `position`.
    func row(of position: Int, _ content: Content) -> Int {
        content.layout.row(forLine: content.doc.lineAt(position).index)
    }

    /// The content's right edge for selections (rightSide: .cm-content's right less the line's 2 points of padding).
    func contentRight(_ content: Content) -> CGFloat {
        let width = max(visibleWidth - CGFloat(content.geometry.guttersWidth), CGFloat(content.geometry.contentWidth))
        return CGFloat(content.geometry.guttersWidth) + width - offsetX - EditorGeometry.linePadding.right
    }
}
