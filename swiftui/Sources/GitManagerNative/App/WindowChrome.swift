// The title bar as the current app draws it: --bg, 32 points tall, no separator line, with the folder name as the
// title. Kept in step with the theme.

import AppKit
import SwiftUI

struct WindowChrome: NSViewRepresentable {
    let background: NSColor

    func makeNSView(context: Context) -> NSView {
        ChromeView()
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        (nsView as? ChromeView)?.background = background
    }

    private final class ChromeView: NSView {
        var background: NSColor = .windowBackgroundColor {
            didSet {
                apply()
            }
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            apply()
            // SwiftUI finishes setting up its window after this view joins it and resets the title bar, so
            // apply again once that is done.
            DispatchQueue.main.async { [weak self] in
                self?.apply()
                // Like the current app, the window starts with nothing focused (SwiftUI would focus the commit
                // message).
                self?.window?.makeFirstResponder(nil)
            }
        }

        private func apply() {
            guard let window else {
                return
            }
            // The content runs under the see-through title bar, so the title bar shows the content's --bg
            // (ContentView paints it); macOS still draws the title and the window buttons on top.
            window.styleMask.insert(.fullSizeContentView)
            window.titlebarAppearsTransparent = true
            window.titlebarSeparatorStyle = .none
            window.backgroundColor = background
        }
    }
}

/// `-appearance light|dark` at launch forces the mode, so gm-measure compares both apps in the same one.
enum AppearanceOption {
    static func apply() {
        switch UserDefaults.standard.string(forKey: "appearance") {
        case "light":
            NSApp.appearance = NSAppearance(named: .aqua)
        case "dark":
            NSApp.appearance = NSAppearance(named: .darkAqua)
        default:
            break
        }
    }
}
