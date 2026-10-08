// Where each row of a diff pane sits, so a view that draws only what is on screen finds its rows by binary search
// instead of laying out all of them (the diff canvas draws a viewport, never the whole file).

import Foundation

public struct RowIndex: Sendable {
    /// Each row's top, after `metrics.padding`; one more entry at the end holds the bottom of the last row.
    public let tops: [Double]

    public init(rows: [DiffRow], metrics: RowMetrics) {
        var tops: [Double] = []
        tops.reserveCapacity(rows.count + 1)
        var y = metrics.padding
        for row in rows {
            tops.append(y)
            y += metrics.height(row)
        }
        tops.append(y)
        self.tops = tops
    }

    /// The bottom of the last row, without the padding below it.
    public var rowsBottom: Double {
        tops.last ?? 0
    }

    /// The rows that cross the band from `top` to `bottom`.
    public func visible(from top: Double, to bottom: Double) -> Range<Int> {
        let count = tops.count - 1
        guard count > 0, bottom > top else {
            return 0..<0
        }
        // The first row whose bottom is below `top`.
        var low = 0
        var high = count
        while low < high {
            let middle = (low + high) / 2
            if tops[middle + 1] <= top {
                low = middle + 1
            } else {
                high = middle
            }
        }
        var end = low
        while end < count, tops[end] < bottom {
            end += 1
        }
        return low..<end
    }
}
