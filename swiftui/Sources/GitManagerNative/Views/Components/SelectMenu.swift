// A <select>'s list as WebKit opens it on macOS (WebPopupMenuProxyMac): an AppKit menu in the select's font, at
// least as wide as the select, with the chosen entry laid over the select's text and checked. The entries are drawn
// with font smoothing like WebKit's (SmoothText).

import AppKit
import SwiftUI

@MainActor
enum SelectMenu {
    /// Where the chosen item's top left corner goes, from the select's (measured against WebKit's menu).
    static let offset = NSPoint(x: -12, y: -1)

    /// The current app leaves its appearance to macOS, so WebKit opens the list in the system's appearance
    /// whatever the page's theme; the native app sets its own (SettingsStore), so it asks for the system's.
    static var systemAppearance: NSAppearance? {
        let dark = UserDefaults.standard.string(forKey: "AppleInterfaceStyle") == "Dark"
        return NSAppearance(named: dark ? .darkAqua : .aqua)
    }

    static func show(
        entries: [String], selected: Int, font: NSFont, width: CGFloat, in view: NSView,
        choose: @escaping (Int) -> Void
    ) {
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.font = font
        menu.minimumWidth = width
        let appearance = systemAppearance
        menu.appearance = appearance
        var normal = NSColor.white
        var highlighted = NSColor.white
        (appearance ?? NSApp.effectiveAppearance).performAsCurrentDrawingAppearance {
            normal = NSColor.labelColor.usingColorSpace(.sRGB) ?? .white
            highlighted = NSColor.selectedMenuItemTextColor.usingColorSpace(.sRGB) ?? .white
        }
        let space: CGColorSpace? = CGColorSpaceCreateDeviceRGB()
        let target = MenuTarget(choose: choose)
        for (index, entry) in entries.enumerated() {
            let item = NSMenuItem(title: entry, action: #selector(MenuTarget.picked(_:)), keyEquivalent: "")
            let titles = (SmoothText.title(entry, font: font, color: normal, space: space),
                          SmoothText.title(entry, font: font, color: highlighted, space: space))
            target.titles[ObjectIdentifier(item)] = titles
            item.attributedTitle = index == selected ? titles.1 : titles.0
            item.tag = index
            item.target = target
            item.state = index == selected ? .on : .off
            menu.addItem(item)
        }
        menu.delegate = target
        // popUp keeps running until the menu closes; the target lives as long as that.
        withExtendedLifetime(target) {
            _ = menu.popUp(positioning: menu.item(at: selected), at: offset, in: view)
        }
    }
}

private final class MenuTarget: NSObject, NSMenuDelegate {
    let choose: (Int) -> Void
    /// Each item's title in the label color and in the highlighted row's color.
    var titles: [ObjectIdentifier: (NSAttributedString, NSAttributedString)] = [:]

    init(choose: @escaping (Int) -> Void) {
        self.choose = choose
    }

    @objc func picked(_ sender: NSMenuItem) {
        choose(sender.tag)
    }

    func menu(_ menu: NSMenu, willHighlight item: NSMenuItem?) {
        for other in menu.items {
            if let pair = titles[ObjectIdentifier(other)] {
                other.attributedTitle = other === item ? pair.1 : pair.0
            }
        }
    }
}

/// An invisible AppKit view behind a SwiftUI control, so a menu can open in its coordinates.
struct MenuAnchor: NSViewRepresentable {
    let found: (NSView) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = FlippedView()
        DispatchQueue.main.async {
            found(view)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {}

    private final class FlippedView: NSView {
        override var isFlipped: Bool {
            true
        }
    }
}
