// The editor's scrolled document view (FileEditorView.swift): as tall and wide as the content, it takes the mouse
// for its host and sets the pointer's shape as the pointer and the Option key move (FileEditorColumns.swift).

import AppKit

/// The scrolled document: as tall and wide as the editor's content, flipped, passing clicks and drags to its host.
final class EditorDocumentView: NSView {
    weak var host: FileScrollView.Host?

    override var isFlipped: Bool {
        true
    }

    override func mouseDown(with event: NSEvent) {
        host?.pressed(event, at: convert(event.locationInWindow, from: nil))
    }

    override func mouseDragged(with event: NSEvent) {
        host?.dragged(to: convert(event.locationInWindow, from: nil), flags: event.modifierFlags)
    }

    override func mouseUp(with event: NSEvent) {
        host?.dragAnchor = nil
        host?.columnDrag = nil
    }

    // The pointer's shape follows it and the Option key (FileEditorColumns.swift).
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas {
            removeTrackingArea(area)
        }
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseMoved, .cursorUpdate, .activeInKeyWindow,
                                                                .inVisibleRect], owner: self))
    }

    override func cursorUpdate(with event: NSEvent) {
        setPointer(event)
    }

    override func mouseMoved(with event: NSEvent) {
        setPointer(event)
    }

    private func setPointer(_ event: NSEvent) {
        guard let host else {
            return
        }
        let point = host.canvasPoint(convert(event.locationInWindow, from: nil))
        host.pointerShape(at: point, option: event.modifierFlags.contains(.option)).set()
    }
}
