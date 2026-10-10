// The field editor of the app's text fields (the find bar, prompts, the Settings search, Find in Files). TextKit 1:
// the default TextKit 2 editor invalidated its cursor rects on every key, and AppKit then set the cursor again
// inside the frame's commit. And a key goes straight to the input system: NSTextView's keyDown first hides the
// pointer with a synchronous WindowServer call (SLSObscureCursor, about 4 ms on every key, more than the rest of the
// key's handling); here the pointer is hidden only when it moved since the last time.

import AppKit

final class FastFieldEditor: NSTextView {
    static func make() -> FastFieldEditor {
        let editor = FastFieldEditor(usingTextLayoutManager: false)
        editor.isFieldEditor = true
        return editor
    }

    override func keyDown(with event: NSEvent) {
        PointerHider.hideWhileTyping()
        if inputContext?.handleEvent(event) != true {
            interpretKeyEvents([event])
        }
        // The typed text on screen now, as NSTextView's own keyDown does, not after the rest of this turn (the
        // search results, SwiftUI's layout).
        displayIfNeeded()
        CATransaction.flush()
    }
}

/// Hides the pointer until it moves, as typing in a text view does, without asking the WindowServer again while it
/// is still hidden from the last key.
@MainActor
enum PointerHider {
    private static var hiddenAt: NSPoint?

    static func hideWhileTyping() {
        let location = NSEvent.mouseLocation
        guard location != hiddenAt else {
            return
        }
        hiddenAt = location
        NSCursor.setHiddenUntilMouseMoves(true)
    }
}

/// A text field cell with a FastFieldEditor of its own.
final class FastFieldCell: NSTextFieldCell {
    private lazy var editor = FastFieldEditor.make()

    override func fieldEditor(for controlView: NSView) -> NSTextView? {
        editor
    }
}
