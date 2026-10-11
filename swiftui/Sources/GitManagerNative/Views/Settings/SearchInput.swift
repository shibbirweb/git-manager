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
    /// Keeps the text selected on focus, as a prompt's select() does.
    var selectsAll = false
    /// A new value takes the keyboard again (the find bar's fields), selecting the text when `selectsAll`.
    var focusToken = 0
    /// Names the field, so key handlers can tell which one has the keyboard.
    var identifier: String?
    /// Called when the field gives up the keyboard.
    var onBlur: () -> Void = {}

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
        if let identifier {
            field.identifier = NSUserInterfaceItemIdentifier(identifier)
        }
        context.coordinator.onBlur = onBlur
        context.coordinator.focusToken = focusToken
        if autofocus || focusToken != 0 {
            Self.focus(field, selectsAll: selectsAll, attempts: 100)
        }
        return field
    }

    /// Gives `field` the keyboard once it is in a window: a field that appears over a view holding the keyboard
    /// (the editor, for Go to Line) is often not in its window yet on the first try. The tries are 10 ms apart: quick
    /// turns of the main queue could all run before SwiftUI put the field in its window, and it then never got
    /// the keyboard (Go to Line's typed line went into the file).
    private static func focus(_ field: NSTextField, selectsAll: Bool, attempts: Int) {
        DispatchQueue.main.asyncAfter(deadline: .now() + (attempts >= 100 ? 0 : 0.01)) {
            guard let window = field.window, window.makeFirstResponder(field), field.currentEditor() != nil else {
                if attempts > 0 {
                    focus(field, selectsAll: selectsAll, attempts: attempts - 1)
                }
                return
            }
            // AppKit selects all of the text on focus; WebKit's focus() leaves the caret after it.
            if !selectsAll {
                let length = (field.stringValue as NSString).length
                field.currentEditor()?.selectedRange = NSRange(location: length, length: 0)
            }
        }
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        if field.stringValue != text {
            field.stringValue = text
        }
        if field.textColor != textColor {
            field.textColor = textColor
        }
        if focusToken != context.coordinator.focusToken {
            context.coordinator.focusToken = focusToken
            Self.focus(field, selectsAll: selectsAll, attempts: 100)
        }
        context.coordinator.onSubmit = onSubmit
        let caret = text.isEmpty ? NSColor.clear : caretColor
        if let field = field as? CaretShowing, field.caretColor != caret {
            field.caretColor = caret
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        @Binding var text: String
        var onSubmit: (() -> Void)?
        var focusToken = 0
        var onBlur: () -> Void = {}

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

        func controlTextDidEndEditing(_ notification: Notification) {
            onBlur()
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
    // The app's field editor (FastFieldEditor.swift).
    override class var cellClass: AnyClass? {
        get {
            FastFieldCell.self
        }
        set {}
    }

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
