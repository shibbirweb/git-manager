// The Log list's rules from LogView.svelte: 26-point rows drawn only around the viewport (12 rows of overscan), the
// filter (subject, author name or email contains the text, or the hash starts with it), the keys that move the
// selection, the scroll that keeps the selected row in view, and when to load the next page.

public enum LogList {
    public static let rowHeight = 26.0
    public static let overscan = 12
    public static let pageSize = 300
    /// Load more once the drawn rows come this close to the end.
    public static let nearEndRows = 80

    /// The positions to draw for a viewport at `scrollTop`, `viewportHeight` tall, over `count` rows.
    public static func visibleRange(scrollTop: Double, viewportHeight: Double, count: Int) -> Range<Int> {
        let start = max(0, Int((scrollTop / rowHeight).rounded(.down)) - overscan)
        let end = min(count, Int(((scrollTop + viewportHeight) / rowHeight).rounded(.up)) + overscan)
        return start..<max(start, end)
    }

    /// Whether the drawn rows reach close enough to the end to load the next page.
    public static func nearEnd(_ range: Range<Int>, count: Int) -> Bool {
        range.upperBound >= count - nearEndRows
    }

    /// matchesQuery: `query` is the filter text trimmed and lowercased.
    public static func matches(
        query: String, commitId: String, summary: String, authorName: String, authorEmail: String
    ) -> Bool {
        commitId.hasPrefix(query) || summary.lowercased().contains(query) || authorName.lowercased().contains(query)
            || authorEmail.lowercased().contains(query)
    }

    public enum Key {
        case down
        case up
        case pageDown
        case pageUp
        case home
        case end
    }

    /// The position a key moves the selection to (clamped later by `clamp`); -1 means nothing is selected.
    public static func target(_ key: Key, current: Int, count: Int, viewportHeight: Double) -> Int {
        let page = max(1, Int((viewportHeight / rowHeight).rounded(.down)) - 1)
        switch key {
        case .down:
            return current + 1
        case .up:
            return current == -1 ? 0 : current - 1
        case .pageDown:
            return current + page
        case .pageUp:
            return current - page
        case .home:
            return 0
        case .end:
            return count - 1
        }
    }

    public static func clamp(_ position: Int, count: Int) -> Int {
        max(0, min(count - 1, position))
    }

    /// The scroll offset that shows the row at `position` (ensureVisible); the same offset when it is in view.
    public static func ensureVisible(position: Int, scrollTop: Double, viewportHeight: Double) -> Double {
        let top = Double(position) * rowHeight
        if top < scrollTop {
            return top
        }
        if top + rowHeight > scrollTop + viewportHeight {
            return top + rowHeight - viewportHeight
        }
        return scrollTop
    }

    /// The list's share of the panes while a commit is selected (listFraction), kept within 15% and 85%.
    public static func listFraction(pointerY: Double, top: Double, height: Double) -> Double {
        max(0.15, min(0.85, (pointerY - top) / max(1, height)))
    }
}
