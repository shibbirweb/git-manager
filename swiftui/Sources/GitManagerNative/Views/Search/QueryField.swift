// The popups' text field (.query: 14 points, no border or background, --text with a --text-faint placeholder). An
// AppKit field, so typing, the caret and selection behave as in any Mac field; the popups' keys (arrows, Page Up and
// Down, Ctrl+N and Ctrl+P, Return, Escape, Tab) go to `onKey` instead.

import AppKit
import SwiftUI

struct QueryField: NSViewRepresentable {
    enum Key {
        case up
        case down
        case pageUp
        case pageDown
        case enter
        case escape
        case tab
    }

    @Binding var value: String
    let placeholder: String
    let textColor: NSColor
    let placeholderColor: NSColor
    /// The selection's background (QueryField.selectionColor).
    let selectionColor: NSColor
    /// Grows each time the whole text should be selected (Search Everywhere opens with its query selected).
    let selectAllRequests: Int
    let onChange: () -> Void
    let onKey: (Key) -> Void

    func makeNSView(context: Context) -> NSTextField {
        let field = NSTextField()
        field.isBordered = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.font = PageFont.ui(14)
        field.lineBreakMode = .byClipping
        field.cell?.isScrollable = true
        field.cell?.wraps = false
        field.delegate = context.coordinator
        DispatchQueue.main.async {
            field.window?.makeFirstResponder(field)
            Self.placeCaret(field, selectAll: selectAllRequests > 0, selectionColor: selectionColor)
        }
        return field
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        context.coordinator.parent = self
        field.textColor = textColor
        field.placeholderAttributedString = NSAttributedString(string: placeholder, attributes: [
            .font: PageFont.ui(14), .foregroundColor: placeholderColor,
        ])
        (field.currentEditor() as? NSTextView)?.selectedTextAttributes = [.backgroundColor: selectionColor]
        if field.stringValue != value {
            field.stringValue = value
        }
        if context.coordinator.selectAllSeen != selectAllRequests {
            context.coordinator.selectAllSeen = selectAllRequests
            DispatchQueue.main.async {
                field.window?.makeFirstResponder(field)
                Self.placeCaret(field, selectAll: true, selectionColor: selectionColor)
            }
        }
    }

    /// After the text, like the page's setSelectionRange(end, end), or over all of it.
    static func placeCaret(_ field: NSTextField, selectAll: Bool, selectionColor: NSColor? = nil) {
        guard let editor = field.currentEditor() else {
            return
        }
        if let selectionColor {
            (editor as? NSTextView)?.selectedTextAttributes = [.backgroundColor: selectionColor]
        }
        let length = (field.stringValue as NSString).length
        editor.selectedRange = selectAll ? NSRange(location: 0, length: length) : NSRange(location: length, length: 0)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: QueryField
        var selectAllSeen: Int

        init(parent: QueryField) {
            self.parent = parent
            selectAllSeen = parent.selectAllRequests
        }

        func controlTextDidChange(_ notification: Notification) {
            guard let field = notification.object as? NSTextField else {
                return
            }
            parent.value = field.stringValue
            parent.onChange()
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            let keys: [Selector: Key] = [
                #selector(NSResponder.moveUp(_:)): .up,
                #selector(NSResponder.moveDown(_:)): .down,
                #selector(NSResponder.scrollPageUp(_:)): .pageUp,
                #selector(NSResponder.scrollPageDown(_:)): .pageDown,
                #selector(NSResponder.pageUp(_:)): .pageUp,
                #selector(NSResponder.pageDown(_:)): .pageDown,
                #selector(NSResponder.insertNewline(_:)): .enter,
                #selector(NSResponder.cancelOperation(_:)): .escape,
                #selector(NSResponder.insertTab(_:)): .tab,
                #selector(NSResponder.insertBacktab(_:)): .tab,
            ]
            // Ctrl+N and Ctrl+P move like the arrows (Emacs keys reach the field as moveDown and moveUp too).
            guard let key = keys[commandSelector] else {
                return false
            }
            parent.onKey(key)
            return true
        }
    }
}

extension QueryField {
    /// WebKit's selection: the system's selection color made translucent so that over white it looks the same
    /// (Color::blendWithWhite: the first alpha from 60% to 80% in steps of 17 that keeps every channel at 0 or
    /// more), then blended over the field's --panel.
    @MainActor
    static func selectionColor(theme: Theme, dark: Bool) -> NSColor {
        var system = NSColor.systemBlue
        // The system color in the window's appearance, not whichever is current while SwiftUI builds the view.
        NSAppearance(named: dark ? .darkAqua : .aqua)?.performAsCurrentDrawingAppearance {
            system = NSColor.selectedTextBackgroundColor.usingColorSpace(.sRGB) ?? .systemBlue
        }
        let channels = [system.redComponent, system.greenComponent, system.blueComponent]
            .map { Int(($0 * 255).rounded()) }
        if dark {
            // In dark the page shows the system color at 80% over the field (measured: 65, 87, 118 on #2b2d30).
            let literal = "rgb(\(channels[0]), \(channels[1]), \(channels[2]))"
            return NSColor(theme.over(literal, 0.8, on: "--panel"))
        }
        var blended = channels
        var alpha = 153
        while alpha <= 204 {
            let white = 255 - alpha
            blended = channels.map { Int(Float($0 - white) / (Float(alpha) / 255)) }
            if blended.allSatisfy({ $0 >= 0 }) {
                break
            }
            alpha += 17
        }
        let literal = "rgb(\(blended[0]), \(blended[1]), \(blended[2]))"
        return NSColor(theme.over(literal, Double(alpha) / 255, on: "--panel"))
    }
}
