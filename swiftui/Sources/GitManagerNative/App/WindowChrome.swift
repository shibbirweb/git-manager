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
            // No macOS window restoration: its snapshotter copies the whole window into a 19 MB buffer whenever
            // the window's state is saved (focus moving after a stage, for one), and that memory stays with the app.
            window.isRestorable = false
        }
    }
}

/// Light, Dark or System from settings.json; `-appearance light|dark` at launch sets it for the run (SettingsStore),
/// so gm-measure compares both apps in the same mode.
@MainActor
enum AppearanceOption {
    static func apply() {
        SettingsStore.shared.applyAppearance()
    }
}
