// Gives the first window the current app's default size (1400 x 880), shrunk to fit the screen.
// SwiftUI's defaultSize falls back to the minimum size when the default does not fit, which on a
// 14-inch MacBook it does not once the menu bar and Dock are taken off. Later launches take the
// frame macOS saved.

import AppKit
import SwiftUI

struct WindowSizer: NSViewRepresentable {
    static let defaultSize = NSSize(width: 1400, height: 880)
    /// Where macOS keeps the window frame of the "main" scene.
    private static let savedFrameKey = "NSWindow Frame main"

    func makeNSView(context: Context) -> NSView {
        SizingView()
    }

    func updateNSView(_ nsView: NSView, context: Context) {}

    private final class SizingView: NSView {
        private var sized = false

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            guard let window, !sized else {
                return
            }
            sized = true
            // `-windowFrame "{{x, y}, {w, h}}"`: gm-measure puts the window on the screen it measures.
            if let frame = UserDefaults.standard.string(forKey: "windowFrame") {
                DispatchQueue.main.async {
                    window.setFrame(NSRectFromString(frame), display: true)
                }
                return
            }
            // The window is not restorable (WindowChrome), so macOS does not put the saved frame back by itself.
            if let saved = UserDefaults.standard.string(forKey: WindowSizer.savedFrameKey) {
                DispatchQueue.main.async {
                    window.setFrame(from: saved)
                }
                return
            }
            DispatchQueue.main.async {
                WindowSizer.applyDefaultSize(to: window)
            }
        }
    }

    private static func applyDefaultSize(to window: NSWindow) {
        guard let visible = (window.screen ?? NSScreen.main)?.visibleFrame else {
            return
        }
        let chrome = window.frame.height - window.contentLayoutRect.height
        let contentSize = NSSize(
            width: min(defaultSize.width, visible.width),
            height: min(defaultSize.height, visible.height - chrome)
        )
        window.setContentSize(contentSize)
        window.center()
    }
}
