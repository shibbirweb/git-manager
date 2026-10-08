// Moving around a side-by-side diff as src/lib/diff/DiffView.svelte and foldModel.ts do: the change counter, the
// previous and next change, the scroll offset that centers a change, and folds that open a step at a time.

import Foundation

/// Which part of a fold a click opens: 10 lines at its top or bottom edge, or all of it (its label).
public enum FoldEdge: Sendable {
    case top
    case bottom
    case all
}

extension DiffFold {
    /// The run still folded after showing lines at one edge, or nil when it opens fully (revealFold): a step that
    /// would leave only a sliver folded opens the rest too.
    public static func reveal(_ range: FoldRange, edge: FoldEdge) -> FoldRange? {
        if edge == .all || range.count - step < minSize {
            return nil
        }
        if edge == .top {
            return FoldRange(first: range.first + step, last: range.last)
        }
        return FoldRange(first: range.first, last: range.last - step)
    }

    /// `folds` after a step on the one at `index`.
    public static func stepping(_ folds: [FoldRange], at index: Int, edge: FoldEdge) -> [FoldRange] {
        guard folds.indices.contains(index) else {
            return folds
        }
        var next = folds
        if let left = reveal(folds[index], edge: edge) {
            next[index] = left
        } else {
            next.remove(at: index)
        }
        return next
    }
}

public enum DiffNavigation {
    /// The toolbar's counter: "No changes", "N changes" before a change is picked, then "2 of 5".
    public static func counterLabel(count: Int, current: Int) -> String {
        if count == 0 {
            return "No changes"
        }
        if current < 0 {
            return count == 1 ? "1 change" : "\(count) changes"
        }
        return "\(current + 1) of \(count)"
    }

    /// The change after (`direction` 1) or before (-1) `current`, wrapping around (goToChunk); -1 without changes.
    public static func step(current: Int, count: Int, direction: Int) -> Int {
        if count == 0 {
            return -1
        }
        if current < 0 || current >= count {
            return direction > 0 ? 0 : count - 1
        }
        return (current + direction + count) % count
    }

    /// The row that shows line `number` (1-based), or the first row after it: a change without lines on this side
    /// starts at the line after its spacer. A line inside a fold gives the fold's row.
    public static func row(ofLine number: Int, in rows: [DiffRow]) -> Int? {
        for (index, row) in rows.enumerated() {
            switch row {
            case .line(let line, _, _) where line >= number:
                return index
            case .fold(let range) where range.last >= number:
                return index
            default:
                continue
            }
        }
        return rows.isEmpty ? nil : rows.count - 1
    }

    /// CodeMirror's scrollIntoView(position, { y: "center" }) for a position at the start of a row at `rowTop`: the
    /// cursor's box (the font's 17-point content area, from a point above the 16-point row) centered in the
    /// viewport. WebKit keeps whole-point scroll offsets and drops the fraction; the scroller stops at its ends.
    public static func centeredOffset(rowTop: Double, viewport: Double, contentHeight: Double) -> Double {
        let caretTop = rowTop - 1
        let caretHeight = 17.0
        let target = (caretTop + caretHeight / 2 - viewport / 2).rounded(.down)
        return min(max(0, contentHeight - viewport), max(0, target))
    }
}
