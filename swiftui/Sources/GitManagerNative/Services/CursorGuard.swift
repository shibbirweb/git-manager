// AppKit sets the cursor again after every layout that touches tracking areas (each key typed into a SwiftUI
// window), and with the accessibility pointer settings each set registers the cursor's images with the window
// server again: a few milliseconds inside the frame's commit, before the frame can show. A set of the cursor
// already set, with the mouse where it was then, changes nothing, so it is skipped; any mouse move lets the next
// set through, so entering the window or another app's cursor in between are handled as before.

import AppKit

enum CursorGuard {
    /// The last cursor set and where the mouse was then.
    @MainActor static var last: (cursor: ObjectIdentifier, location: NSPoint)?

    static func install() {
        guard let original = class_getInstanceMethod(NSCursor.self, #selector(NSCursor.set)),
              let guarded = class_getInstanceMethod(NSCursor.self, #selector(NSCursor.gmGuardedSet)) else {
            return
        }
        method_exchangeImplementations(original, guarded)
    }
}

extension NSCursor {
    /// NSCursor.set once CursorGuard is installed (the implementations are exchanged, so this calls the original).
    @MainActor @objc func gmGuardedSet() {
        let current = (cursor: ObjectIdentifier(self), location: NSEvent.mouseLocation)
        if let last = CursorGuard.last, last.cursor == current.cursor, last.location == current.location,
           NSApp.isActive {
            return
        }
        CursorGuard.last = current
        gmGuardedSet()
    }
}
