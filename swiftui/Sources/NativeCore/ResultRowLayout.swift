// Where the pieces of a Find in Files row go (src/lib/search/TextResult.svelte, as PopupRowFrame lays it out: 8
// points of padding each side). A file row: the 13-point icon, 6 points, the name, 6, the folder (which gives way
// when the row is short), 6, room, 6, the count at the right. A line row: its number right-aligned in a 38-point
// column, 8 points, then the line. Positions are in the list's points, from the row's left edge.

import Foundation

public enum ResultRowLayout {
    public static let rowHeight = 26.0
    public static let padding = 8.0
    public static let iconSize = 13.0

    public struct File: Equatable, Sendable {
        public let icon: Double
        public let name: Double
        public let folder: Double
        /// The folder's room: its own width, or less when the row is short (then it ends in an ellipsis).
        public let folderRoom: Double
        public let count: Double
    }

    public struct Line: Equatable, Sendable {
        public let number: Double
        public let text: Double
    }

    /// A file row from `left` to `right` (the row's edges) with its texts' exact widths.
    public static func file(left: Double, right: Double, nameWidth: Double, folderWidth: Double,
                            countWidth: Double) -> File {
        let content = left + padding
        let name = content + iconSize + 6
        let folder = name + nameWidth + 6
        let count = right - padding - countWidth
        let room = max(0, count - 12 - folder)
        return File(icon: content, name: name, folder: folder, folderRoom: min(folderWidth, room), count: count)
    }

    /// A line row from `left`, its number `numberWidth` wide.
    public static func line(left: Double, numberWidth: Double) -> Line {
        let content = left + padding
        return Line(number: content + 38 - numberWidth, text: content + 46)
    }

    /// The row under `y` (the list's points from its top), or nil above the first row or below the last.
    public static func row(at y: Double, scrollTop: Double, paddingTop: Double, count: Int) -> Int? {
        let offset = y + scrollTop - paddingTop
        guard offset >= 0 else {
            return nil
        }
        let index = Int(offset / rowHeight)
        return index < count ? index : nil
    }
}
