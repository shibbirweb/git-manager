// Hover as the page has it. WebKit knows no pointer until the mouse moves over the window, so nothing shows its
// hover look under a pointer resting where the window opened (measuring leaves the pointer alone, often over the
// window); once the pointer has moved, hover follows it as usual. SwiftUI's onHover lights a view up at once.

import AppKit
import SwiftUI

@MainActor
enum PointerGate {
    private static var start: CGPoint?
    private static var moved = false

    /// Called as the window opens: where the pointer rests then.
    static func begin() {
        if start == nil {
            start = NSEvent.mouseLocation
        }
    }

    /// True once the pointer has left the place it rested at when the window opened.
    static var hasMoved: Bool {
        if !moved, let start, NSEvent.mouseLocation != start {
            moved = true
        }
        return moved || start == nil
    }
}

private struct PageHover: ViewModifier {
    let action: (Bool) -> Void
    @State private var shown = false

    func body(content: Content) -> some View {
        content.onContinuousHover { phase in
            var inside = false
            if case .active = phase {
                inside = PointerGate.hasMoved
            }
            if inside != shown {
                shown = inside
                action(inside)
            }
        }
    }
}

extension View {
    /// onHover as WebKit's :hover and mouseenter behave (PointerGate).
    func pageHover(perform action: @escaping (Bool) -> Void) -> some View {
        modifier(PageHover(action: action))
    }
}
