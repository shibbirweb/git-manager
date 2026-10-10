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
    /// A password field (NSSecureTextField): the characters show as dots.
    var secure = false
    /// Return in the field.
    var onSubmit: (() -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    func makeNSView(context: Context) -> NSTextField {
        let field: NSTextField & CaretShowing = secure ? SecureCaretField() : CaretField()
        field.isBordered = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.font = font
        field.onFocus = onFocus
        context.coordinator.onSubmit = onSubmit
        field.delegate = context.coordinator
        field.lineBreakMode = .byClipping
        field.cell?.isScrollable = true
        if autofocus {
            DispatchQueue.main.async {
                field.window?.makeFirstResponder(field)
                // AppKit selects all of the text on focus; WebKit's focus() leaves the caret after it.
                let length = (field.stringValue as NSString).length
                field.currentEditor()?.selectedRange = NSRange(location: length, length: 0)
            }
        }
        return field
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        if field.stringValue != text {
            field.stringValue = text
        }
        field.textColor = textColor
        context.coordinator.onSubmit = onSubmit
        (field as? CaretShowing)?.caretColor = text.isEmpty ? .clear : caretColor
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        @Binding var text: String
        var onSubmit: (() -> Void)?

        init(text: Binding<String>) {
            _text = text
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            guard commandSelector == #selector(NSResponder.insertNewline(_:)), let onSubmit else {
                return false
            }
            onSubmit()
            return true
        }

        func controlTextDidChange(_ notification: Notification) {
            if let field = notification.object as? NSTextField {
                text = field.stringValue
            }
        }
    }
}

/// A field that shows the caret in its own color and says when it takes the keyboard.
protocol CaretShowing: AnyObject {
    var onFocus: () -> Void { get set }
    var caretColor: NSColor { get set }
}

final class SecureCaretField: NSSecureTextField, CaretShowing {
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

final class CaretField: NSTextField, CaretShowing {
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
