// The first diff of a session built SwiftUI's views for the tab strip and the diff screen for the first time: type
// metadata, layout descriptors and conformance lookups, about 100 ms on the main thread before anything showed. A
// two-line diff is built and laid out off screen once after launch instead, then dropped; only those process-wide
// caches stay. Skipped once a real diff is open, which has paid that cost already.

import AppKit
import NativeCore
import SwiftUI

@MainActor
enum ViewWarmUp {
    static func diffScreen(theme: Theme) {
        guard AppModel.shared.openDiff == nil else {
            return
        }
        // The control server's `diff` action reads the diff on screen, not this one.
        let shown = DiffState.shown
        defer { DiffState.shown = shown }
        let diff = FileDiff(
            path: "warm-up.txt", original: "a\nb\n", modified: "a\nc\n", binary: false, tooLarge: false,
            hunks: [[1, 2, 1, 2]]
        )
        let open = OpenDiff(filePath: diff.path, staged: false, diff: diff)
        let root = VStack(spacing: 0) {
            EditorTabStrip(diffName: diff.path, diffActive: true, tabs: EditorTabs())
            DiffScreen(open: open)
        }
        .environment(\.theme, theme)
        let host = NSHostingView(rootView: root)
        host.frame = NSRect(x: 0, y: 0, width: 900, height: 600)
        host.layoutSubtreeIfNeeded()
    }
}
