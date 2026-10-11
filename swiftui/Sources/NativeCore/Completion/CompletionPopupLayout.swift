// The completion popup's geometry, measured on the current app (features.ts completionTheme over CodeMirror's base
// theme): a 1-point border around a list with 3 points of padding above and below, at most 16em (208 points) tall,
// at least 240 wide; rows of 22 points (1 of padding, a 20-point line box); in a row, 6 points, the 12.625-point
// badge, 5.616 points, the label, 1.2em, the detail, 10 points. A list taller than its room scrolls with the page's
// 10-point scrollbar, which takes its width from the rows. Placed below the cursor's line at the completed text's
// left, or above when the window has more room there, kept inside the window.

import Foundation

public struct CompletionPopupLayout: Equatable, Sendable {
    public static let border = 1.0
    public static let listPadding = 3.0
    public static let rowHeight = 22.0
    public static let maxListHeight = 208.0
    public static let minListWidth = 240.0
    public static let maxListWidth = 700.0
    public static let rowLeft = 6.0
    public static let rowRight = 10.0
    public static let badge = 12.625
    public static let badgeGap = 5.616
    public static let detailGap = 15.6
    public static let scrollbar = 10.0
    /// The "···" line above or below a list cut to 100 options (normal line height of the code font).
    public static let markerHeight = 17.0

    /// The list's width and height (the popup is the border more each way).
    public let listWidth: Double
    public let listHeight: Double
    /// All the list's content: padding, markers and rows.
    public let contentHeight: Double
    public let markerTop: Bool
    public let markerBottom: Bool
    public let rows: Int

    /// `rowWidths`: each rendered row's label and detail widths (detail 0 for none).
    public init(rowWidths: [(label: Double, detail: Double)], markerTop: Bool = false, markerBottom: Bool = false,
                room: Double = .infinity) {
        rows = rowWidths.count
        self.markerTop = markerTop
        self.markerBottom = markerBottom
        contentHeight = 2 * Self.listPadding + Double(rows) * Self.rowHeight
            + (markerTop ? Self.markerHeight : 0) + (markerBottom ? Self.markerHeight : 0)
        listHeight = min(contentHeight, Self.maxListHeight, room)
        let widest = rowWidths.map { widths in
            Self.rowLeft + Self.badge + Self.badgeGap + widths.label
                + (widths.detail > 0 ? Self.detailGap + widths.detail : 0) + Self.rowRight
        }.max() ?? 0
        let bar = contentHeight > listHeight + 0.5 ? Self.scrollbar : 0
        listWidth = min(Self.maxListWidth, max(Self.minListWidth, widest + bar))
    }

    public var overflows: Bool {
        contentHeight > listHeight + 0.5
    }

    /// The rows' width (the scrollbar takes its room from them).
    public var rowWidth: Double {
        listWidth - (overflows ? Self.scrollbar : 0)
    }

    public var width: Double {
        listWidth + 2 * Self.border
    }

    public var height: Double {
        listHeight + 2 * Self.border
    }

    /// A rendered row's top in the list's content (before scrolling).
    public func rowTop(_ index: Int) -> Double {
        Self.listPadding + (markerTop ? Self.markerHeight : 0) + Double(index) * Self.rowHeight
    }

    /// The row at a point of the list's content, if any.
    public func row(at contentY: Double) -> Int? {
        let index = Int(((contentY - rowTop(0)) / Self.rowHeight).rounded(.down))
        return contentY >= rowTop(0) && index < rows ? index : nil
    }

    /// The scroll offset after scrolling the list just enough to show row `index` (scrollIntoView).
    public func scrollTop(showing index: Int, from scrollTop: Double) -> Double {
        let top = rowTop(index), bottom = top + Self.rowHeight
        if top < scrollTop {
            return top
        }
        if bottom > scrollTop + listHeight {
            return bottom - listHeight
        }
        return scrollTop
    }

    public var maxScrollTop: Double {
        max(0, contentHeight - listHeight)
    }

    /// How many whole rows the popup shows, for Page Up and Page Down (its height over a row's).
    public var pageRows: Int {
        Int((height / Self.rowHeight).rounded(.down))
    }

    /// The popup's top left: `anchorX` is the completed text's left, `lineTop` and `lineBottom` its line's box;
    /// `space` the window's room. Below unless only above has the room and more of it; nil above means below.
    public static func place(width: Double, height: Double, anchorX: Double, lineTop: Double, lineBottom: Double,
                             space: (left: Double, top: Double, right: Double, bottom: Double))
        -> (x: Double, y: Double, above: Bool, room: Double) {
        let x = width > space.right - space.left ? space.left : max(space.left, min(anchorX, space.right - width))
        var above = false
        if lineBottom + height > space.bottom && space.bottom - lineBottom <= lineTop - space.top {
            above = true
        }
        let room = above ? lineTop - space.top : space.bottom - lineBottom
        let shown = min(height, room)
        return (x, above ? lineTop - shown : lineBottom, above, room)
    }
}
