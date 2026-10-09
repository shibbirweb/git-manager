// The Settings search's text input: a plain AppKit field (no border, no background, no focus ring) that takes the
// focus when the dialog opens. While it is empty, the page shows WebKit's caret at its start: 2 points wide,
// --text, 15.3 points tall (measured: 6.11 points below the field's top), drawn here as a shape, since AppKit's caret
// is thinner, accent colored and placed half a point further left. Once something is typed, AppKit's caret shows.

import AppKit
import SwiftUI

struct SearchInput: NSViewRepresentable {
    @Binding var text: String
    let textColor: NSColor
    let caretColor: NSColor
    var font: NSFont = PageFont.ui(13)
    /// Takes the keyboard when it appears (the dialogs' first field).
    var autofocus = true
    /// Called when the field takes the keyboard.
    var onFocus: () -> Void = {}

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    func makeNSView(context: Context) -> CaretField {
        let field = CaretField()
        field.isBordered = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.font = font
        field.onFocus = onFocus
        field.delegate = context.coordinator
        field.lineBreakMode = .byClipping
        field.cell?.isScrollable = true
        if autofocus {
            DispatchQueue.main.async {
                field.window?.makeFirstResponder(field)
            }
        }
        return field
    }

    func updateNSView(_ field: CaretField, context: Context) {
        if field.stringValue != text {
            field.stringValue = text
        }
        field.textColor = textColor
        field.caretColor = text.isEmpty ? .clear : caretColor
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        @Binding var text: String

        init(text: Binding<String>) {
            _text = text
        }

        func controlTextDidChange(_ notification: Notification) {
            if let field = notification.object as? NSTextField {
                text = field.stringValue
            }
        }
    }
}

final class CaretField: NSTextField {
    var onFocus: () -> Void = {}
    var caretColor: NSColor = .textColor {
        didSet {
            (currentEditor() as? NSTextView)?.insertionPointColor = caretColor
        }
    }

    override func becomeFirstResponder() -> Bool {
        let became = super.becomeFirstResponder()
        (currentEditor() as? NSTextView)?.insertionPointColor = caretColor
        if became {
            onFocus()
        }
        return became
    }
}
