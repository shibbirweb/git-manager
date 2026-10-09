// The context menu's state (src/lib/ui/menu.svelte.ts and ContextMenuHost.svelte): the root items opened at a page
// point, the highlighted row per open level and how many submenus are open. A press outside the menus closes it and
// still reaches what was pressed, as a mousedown on the page does, and so does the window losing focus; the keys
// move, open, run and close.

import AppKit
import NativeCore

@MainActor
final class ContextMenuCenter: ObservableObject {
    static let shared = ContextMenuCenter()

    @Published private(set) var items: [MenuItem] = []
    /// Where the menu was opened, in page points (the window below the title bar).
    @Published private(set) var origin = CGPoint.zero
    @Published private(set) var alignEnd = false
    @Published private(set) var visible = false
    /// The highlighted index per open level (-1: none).
    @Published private(set) var path: [Int] = [-1]
    /// How many submenus are open below the root.
    @Published private(set) var openDepth = 0
    /// Each shown menu's box in page points, written by the view, for presses outside them.
    var boxes: [CGRect] = []
    private var monitor: Any?
    private var blurObserver: NSObjectProtocol?

    /// The root items, then the items of each open submenu.
    var levels: [[MenuItem]] {
        var result = [items]
        for level in 0..<openDepth {
            let index = path.count > level ? path[level] : -1
            guard index >= 0, index < result[level].count, let sub = result[level][index].submenuItems,
                  !result[level][index].disabled else {
                break
            }
            result.append(sub)
        }
        return result
    }

    /// The level the arrow keys move in: the deepest one with a highlighted row.
    var focusLevel: Int {
        for level in stride(from: levels.count - 1, to: 0, by: -1) where highlighted(level) >= 0 {
            return level
        }
        return 0
    }

    func highlighted(_ level: Int) -> Int {
        path.count > level ? path[level] : -1
    }

    func open(_ items: [MenuItem], at point: CGPoint, alignEnd: Bool = false, keyboard: Bool = false) {
        self.items = items
        origin = point
        self.alignEnd = alignEnd
        openDepth = 0
        path = [keyboard ? MenuNav.firstIndex(items) : -1]
        boxes = []
        visible = true
        installMonitor()
    }

    func close() {
        guard visible else {
            return
        }
        visible = false
        items = []
        if let monitor {
            NSEvent.removeMonitor(monitor)
        }
        monitor = nil
        if let blurObserver {
            NotificationCenter.default.removeObserver(blurObserver)
        }
        blurObserver = nil
    }

    func hover(level: Int, index: Int) {
        let item = levels[level][index]
        if !item.isSelectable {
            path = Array(path.prefix(level)) + [-1]
            openDepth = level
        } else if item.submenuItems != nil {
            openSubmenu(level: level, index: index, highlightFirst: false)
        } else {
            path = Array(path.prefix(level)) + [index]
            openDepth = level
        }
    }

    func activate(level: Int, index: Int, fromKeyboard: Bool) {
        let item = levels[level][index]
        guard item.isSelectable else {
            return
        }
        switch item.kind {
        case .submenu:
            if openDepth > level && highlighted(level) == index && !fromKeyboard {
                openDepth = level
                path = Array(path.prefix(level + 1))
            } else {
                openSubmenu(level: level, index: index, highlightFirst: fromKeyboard)
            }
        case .command(let action):
            close()
            action()
        case .separator:
            break
        }
    }

    private func openSubmenu(level: Int, index: Int, highlightFirst: Bool) {
        let item = levels[level][index]
        guard let sub = item.submenuItems, !item.disabled else {
            return
        }
        path = Array(path.prefix(level)) + [index, highlightFirst ? MenuNav.firstIndex(sub) : -1]
        openDepth = level + 1
    }

    private func setHighlight(_ level: Int, _ index: Int) {
        path = Array(path.prefix(level)) + [index]
        openDepth = level
    }

    /// One key while the menu shows; true when the menu used it.
    func key(_ event: NSEvent) -> Bool {
        let level = focusLevel
        let items = levels[level]
        let current = highlighted(level)
        switch event.keyCode {
        case 125:
            setHighlight(level, MenuNav.stepIndex(items, from: current, direction: 1))
        case 126:
            setHighlight(level, MenuNav.stepIndex(items, from: current, direction: -1))
        case 115:
            setHighlight(level, MenuNav.firstIndex(items))
        case 119:
            setHighlight(level, MenuNav.lastIndex(items))
        case 124:
            if current >= 0 && items[current].submenuItems != nil {
                openSubmenu(level: level, index: current, highlightFirst: true)
            }
        case 123:
            if level > 0 {
                openDepth = level - 1
                path = Array(path.prefix(level))
            }
        case 53:
            if level > 0 {
                openDepth = level - 1
                path = Array(path.prefix(level))
            } else {
                close()
            }
        case 36, 76, 49:
            if current >= 0 {
                activate(level: level, index: current, fromKeyboard: true)
            }
        case 48:
            close()
        default:
            let flags = event.modifierFlags.intersection([.command, .control, .option])
            guard flags.isEmpty, let key = event.characters, key.count == 1 else {
                return false
            }
            let match = MenuNav.matchIndex(items, from: current, key: key)
            if match >= 0 {
                setHighlight(level, match)
            }
        }
        return true
    }

    private func installMonitor() {
        guard monitor == nil else {
            return
        }
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .keyDown]) { event in
            let center = ContextMenuCenter.shared
            guard center.visible else {
                return event
            }
            if event.type == .keyDown {
                return center.key(event) ? nil : event
            }
            if !center.boxes.contains(where: { $0.contains(center.pagePoint(event)) }) {
                center.close()
            }
            return event
        }
        // The page closes it when the window loses focus.
        blurObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.didResignKeyNotification, object: nil, queue: .main
        ) { _ in
            MainActor.assumeIsolated {
                ContextMenuCenter.shared.close()
            }
        }
    }

    /// An event's place in page points: the window's content from its top, less the title bar.
    private func pagePoint(_ event: NSEvent) -> CGPoint {
        let height = event.window?.contentView?.bounds.height ?? 0
        return CGPoint(x: event.locationInWindow.x, y: height - event.locationInWindow.y - pageTop)
    }

    /// The page's top in the window's content (the title bar's height), written by the view.
    var pageTop: CGFloat = 32
}
