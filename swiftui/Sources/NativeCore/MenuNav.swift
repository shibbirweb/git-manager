// The context menu's items, keyboard steps and placement (src/lib/ui/menu.svelte.ts and menuNav.ts), and where
// WebKit puts the click of a button pressed without a pointer (Accessibility or the keyboard), where a menu that
// opens at the pointer then opens.

import CoreGraphics

public struct MenuItem {
    public enum Kind {
        case command(action: () -> Void)
        case submenu([MenuItem])
        case separator
    }

    public let kind: Kind
    public let label: String
    public let hint: String?
    public let disabled: Bool
    public let danger: Bool

    public static func command(
        _ label: String, hint: String? = nil, disabled: Bool = false, danger: Bool = false,
        action: @escaping () -> Void
    ) -> MenuItem {
        MenuItem(kind: .command(action: action), label: label, hint: hint, disabled: disabled, danger: danger)
    }

    public static func submenu(_ label: String, _ items: [MenuItem], disabled: Bool = false) -> MenuItem {
        MenuItem(kind: .submenu(items), label: label, hint: nil, disabled: disabled, danger: false)
    }

    public static let separator = MenuItem(kind: .separator, label: "", hint: nil, disabled: false, danger: false)

    public var isSeparator: Bool {
        if case .separator = kind {
            return true
        }
        return false
    }

    public var submenuItems: [MenuItem]? {
        if case .submenu(let items) = kind {
            return items
        }
        return nil
    }

    public var isSelectable: Bool {
        !isSeparator && !disabled
    }
}

public enum MenuNav {
    /// The space the menu keeps from the window's edges.
    public static let margin: CGFloat = 4

    /// The next selectable index after `from` in `direction` (1 or -1), wrapping around; -1 when there is none.
    public static func stepIndex(_ items: [MenuItem], from: Int, direction: Int) -> Int {
        let count = items.count
        if count == 0 {
            return -1
        }
        var index = from < 0 ? (direction == 1 ? -1 : count) : from
        for _ in 0..<count {
            index = (index + direction + count) % count
            if items[index].isSelectable {
                return index
            }
        }
        return -1
    }

    public static func firstIndex(_ items: [MenuItem]) -> Int {
        stepIndex(items, from: -1, direction: 1)
    }

    public static func lastIndex(_ items: [MenuItem]) -> Int {
        stepIndex(items, from: -1, direction: -1)
    }

    /// Type-ahead: the next selectable item after `from` whose label starts with `key`.
    public static func matchIndex(_ items: [MenuItem], from: Int, key: String) -> Int {
        let wanted = key.lowercased()
        let count = items.count
        guard count > 0 else {
            return -1
        }
        for step in 1...count {
            let index = (max(from, -1) + step) % count
            let item = items[index]
            let label = item.label.drop { $0 == " " }.lowercased()
            if item.isSelectable && label.hasPrefix(wanted) {
                return index
            }
        }
        return -1
    }

    /// Where the root menu goes, kept inside the window; `alignEnd` puts its right edge at `x`.
    public static func rootPosition(x: CGFloat, y: CGFloat, menu: CGSize, viewport: CGSize, alignEnd: Bool = false)
        -> CGPoint {
        let wantedLeft = alignEnd ? x - menu.width : x
        let left = max(margin, min(wantedLeft, viewport.width - menu.width - margin))
        let top = max(margin, min(y, viewport.height - menu.height - margin))
        return CGPoint(x: left, y: top)
    }

    /// Where a submenu goes: right of its row, else left of the parent menu, kept inside the window.
    public static func submenuPosition(row: CGRect, menu: CGSize, viewport: CGSize) -> CGPoint {
        var left = row.maxX - 2
        if left + menu.width > viewport.width - margin {
            left = max(margin, row.minX - menu.width + 2)
        }
        // Line the first item up with the row (the menu has 4 points of padding).
        let top = max(margin, min(row.minY - 5, viewport.height - menu.height - margin))
        return CGPoint(x: left, y: top)
    }

    /// The page point of a click on an element pressed without the pointer: WebKit's simulated click lands on the
    /// center of the element's box, cut to whole points (MouseEvent keeps whole client coordinates).
    public static func simulatedClickPoint(_ box: CGRect) -> CGPoint {
        CGPoint(x: box.midX.rounded(.down), y: box.midY.rounded(.down))
    }

    /// A label as HTML shows it (white-space: nowrap): runs of spaces as one, none at either end.
    public static func shownLabel(_ label: String) -> String {
        label.split(whereSeparator: { $0 == " " || $0 == "\t" || $0 == "\n" }).joined(separator: " ")
    }
}
