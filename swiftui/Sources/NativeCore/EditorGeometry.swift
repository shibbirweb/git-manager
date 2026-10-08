// Where the file editor's parts sit (CodeMirror in src/lib/views/files/FileView.svelte, measured in
// swiftui/Reference/file-<mode>/file-layout.json): the gutters (line numbers at least 40 points, the 5-point change
// gutter, the 14-point fold gutter), the content from 4 points down with room to scroll the last line to the top
// (scrollPastEnd), and the scrollbars' thumbs (app.css ::-webkit-scrollbar, 10 points, the thumb 2 points in).

import Foundation

public struct EditorGeometry: Equatable, Sendable {
    public static let lineHeight = 16.0
    public static let topPadding = 4.0
    public static let changeGutterWidth = 5.0
    public static let foldGutterWidth = 14.0
    /// The scrollers' custom scrollbar, and the 12-point change ruler at the editor's right edge.
    public static let scrollbarSize = 10.0
    public static let rulerWidth = 12.0
    /// CodeMirror's line padding: 6 points left, 2 right.
    public static let linePadding = (left: 6.0, right: 2.0)

    public let lineCount: Int
    /// The widest line, in characters of the monospaced code font.
    public let widestLine: Int
    public let advance: Double

    public init(lineCount: Int, widestLine: Int, advance: Double) {
        self.lineCount = max(1, lineCount)
        self.widestLine = widestLine
        self.advance = advance
    }

    /// The line numbers' gutter: 12 points before and 10 after the widest number, at least 40 points.
    public var numbersWidth: Double {
        max(40, 22 + Double(String(lineCount).count) * advance)
    }

    public var guttersWidth: Double {
        numbersWidth + Self.changeGutterWidth + Self.foldGutterWidth
    }

    /// The content's width: the widest line and its padding.
    public var contentWidth: Double {
        Double(widestLine) * advance + Self.linePadding.left + Self.linePadding.right
    }

    public var rowsBottom: Double {
        Self.topPadding + Double(lineCount) * Self.lineHeight
    }

    /// What scrolls: the rows, then room to bring the last line to the top of a `viewport` this tall (CodeMirror's
    /// scrollPastEnd: the viewport less a line, the top padding and half a point).
    public func documentHeight(viewport: Double) -> Double {
        rowsBottom + max(0, viewport - Self.lineHeight - Self.topPadding - 0.5)
    }

    /// Whether the content is wider than the scroller's `visibleWidth` (its width less the vertical scrollbar).
    public func scrollsSideways(visibleWidth: Double, noteEnd: Double = 0) -> Bool {
        guttersWidth + max(contentWidth, noteEnd) > visibleWidth + 0.5
    }

    /// A scrollbar thumb along a `track` showing `visible` of `total`, scrolled to `offset`: its start and length in
    /// the track, before the 2-point inset. WebKit sizes the thumb in whole points; nil when nothing scrolls. The
    /// thumb has no min-height in app.css, so only its 2-point borders keep it from vanishing.
    public static func thumb(
        track: Double, visible: Double, total: Double, offset: Double
    ) -> (start: Double, length: Double)? {
        guard total > visible + 0.5, track > 0 else {
            return nil
        }
        let length = min(track, max(6, (track * visible / total).rounded()))
        let travel = total - visible
        let start = travel > 0 ? (track - length) * min(1, max(0, offset / travel)) : 0
        return (start, length)
    }
}
