// How a merge pane decorates its lines (src/lib/merge/extensions.ts lineDecorations), where its overview ruler puts
// ticks (src/lib/editor/scrollMarkers.ts layoutTicks) and the connector ribbons between panes (MergeEditor.svelte
// span and ribbon). Pure geometry, so the canvas only paints.

import Foundation

/// What one line of a pane shows of the chunks.
public struct MergeLineStyle: Equatable, Sendable {
    /// The chunk's tint over the whole line (cm-mc-line).
    public var tint: ChangeType?
    /// A 1-point edge line at the top or bottom of the line (cm-mc-first, cm-mc-last, cm-mc-single).
    public var edgeTop = false
    public var edgeBottom = false
    /// An empty chunk's 2-point edge above this line (cm-mc-gap-before) or below it (cm-mc-gap-after).
    public var gapBefore: ChangeType?
    public var gapAfter: ChangeType?
    /// The edges' color: the chunk's type.
    public var edge: ChangeType?
    /// Word-level changes inside this line, as UTF-16 ranges of the line.
    public var inline: [Range<Int>] = []

    public init() {}
}

public enum MergePaneLayout {
    /// Each decorated line's style, by 0-based line index. `inline` gives a mark's word changes as offsets from its
    /// first line's start, across lines.
    public static func styles(
        lines: [String], marks: [MergeLineMark], inline: (MergeLineMark) -> [Range<Int>]? = { _ in nil }
    ) -> [Int: MergeLineStyle] {
        var styles: [Int: MergeLineStyle] = [:]
        let lineCount = lines.count
        for mark in marks {
            let start = mark.range.start, end = mark.range.end
            if start < end {
                let last = min(end, lineCount) - 1
                guard start <= last else {
                    continue
                }
                for index in start...last {
                    var style = styles[index] ?? MergeLineStyle()
                    style.tint = mark.type
                    style.edge = mark.type
                    style.edgeTop = style.edgeTop || index == start
                    style.edgeBottom = style.edgeBottom || index == last
                    styles[index] = style
                }
                if let spans = inline(mark), !spans.isEmpty {
                    place(spans, lines: lines, from: start, to: last, into: &styles)
                }
            } else if start < lineCount {
                var style = styles[start] ?? MergeLineStyle()
                style.gapBefore = mark.type
                styles[start] = style
            } else if lineCount > 0 {
                var style = styles[lineCount - 1] ?? MergeLineStyle()
                style.gapAfter = mark.type
                styles[lineCount - 1] = style
            }
        }
        return styles
    }

    /// Splits block offsets (from line `from`'s start, "\n" between lines) into per-line ranges.
    static func place(
        _ spans: [Range<Int>], lines: [String], from: Int, to: Int, into styles: inout [Int: MergeLineStyle]
    ) {
        var lineStart = 0
        for index in from...to {
            let length = lines[index].utf16.count
            for span in spans {
                let lower = max(span.lowerBound, lineStart), upper = min(span.upperBound, lineStart + length)
                if lower < upper {
                    styles[index]?.inline.append((lower - lineStart)..<(upper - lineStart))
                }
            }
            lineStart += length + 1
        }
    }

    public struct Tick: Equatable, Sendable {
        public var top: Double
        public var height: Double
        public let type: ChangeType
    }

    /// The ruler's ticks for `marks` in a track `trackHeight` points tall, for a document of `lineCount` lines of
    /// `lineHeight` with `padding` above and below.
    public static func ticks(
        marks: [MergeLineMark], lineCount: Int, lineHeight: Double, padding: Double, trackHeight: Double
    ) -> [Tick] {
        let total = max(1, Double(lineCount) * lineHeight + padding * 2)
        let scale = trackHeight / total
        var ticks: [Tick] = []
        for mark in marks {
            let first = min(mark.range.start, lineCount - 1)
            let top = Double(first) * lineHeight
            var bottom = top
            if mark.range.end > mark.range.start {
                bottom = Double(min(mark.range.end, lineCount)) * lineHeight
            }
            let tick = Tick(top: top * scale, height: max(3, (bottom - top) * scale), type: mark.type)
            if let last = ticks.last, last.type == tick.type, tick.top <= last.top + last.height + 1 {
                ticks[ticks.count - 1].height = max(last.height, tick.top + tick.height - last.top)
            } else {
                ticks.append(tick)
            }
        }
        return ticks
    }

    /// A chunk's lines in a pane, in the panes' coordinates: the top and bottom of lines `range` (an empty range is
    /// the top of its line, or the bottom of the last line past the end), for a pane scrolled to `offset` whose rows
    /// start `padding` points down.
    public static func span(
        _ range: LineRange, lineCount: Int, lineHeight: Double, padding: Double, offset: Double
    ) -> (top: Double, bottom: Double) {
        let origin = padding - offset
        if range.start < range.end {
            let first = min(range.start, lineCount - 1), last = min(range.end, lineCount)
            return (origin + Double(first) * lineHeight, origin + Double(last) * lineHeight)
        }
        if range.start < lineCount {
            let top = origin + Double(range.start) * lineHeight
            return (top, top)
        }
        let bottom = origin + Double(lineCount) * lineHeight
        return (bottom, bottom)
    }
}
