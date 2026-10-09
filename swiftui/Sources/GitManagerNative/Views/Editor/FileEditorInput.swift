// The editor's keyboard and mouse, as CodeMirror's view takes them: a key press runs the keymap's commands in order
// (EditorKeymap, the next when one does nothing), else printable text is typed (EditorInput); Copy, Cut, Paste,
// Undo and Redo also come from the Edit menu through the responder chain. A click puts the cursor, Shift extends
// the main range, Cmd adds a cursor, a double click selects the word and a triple click the line; a drag extends
// from where it started.

import AppKit
import NativeCore

extension FileScrollView.Host {
    override func keyDown(with event: NSEvent) {
        guard let session else {
            super.keyDown(with: event)
            return
        }
        let flags = event.modifierFlags
        let command = flags.contains(.command), control = flags.contains(.control)
        let key = Self.keyName(event)
        let actions = EditorKeymap.actions(key: key, command: command, option: flags.contains(.option),
                                           control: control, shift: flags.contains(.shift))
        for action in actions where perform(action, session) {
            return
        }
        // Without an Edit menu the clipboard keys still work.
        if command && !control, let fallback = ["c": EditorAction.copy, "x": .cut, "v": .paste][key],
           perform(fallback, session) {
            return
        }
        if !command && !control, let text = event.characters, Self.isPrintable(text) {
            session.dispatch(EditorInput.type(session.state, text, style: session.style))
            afterChange()
            return
        }
        super.keyDown(with: event)
    }

    /// Runs one editor action; false when it did nothing.
    func perform(_ action: EditorAction, _ session: EditorSession) -> Bool {
        switch action {
        case .copy:
            return copySelection(session)
        case .cut:
            guard copySelection(session), let spec = EditorInput.cut(session.state) else {
                return false
            }
            session.dispatch(spec)
        case .paste:
            guard let text = NSPasteboard.general.string(forType: .string) else {
                return false
            }
            session.dispatch(EditorInput.paste(session.state, text, lastLinewiseCopy: session.lastLinewiseCopy))
        case .save:
            Task {
                await EditorModel.shared.save()
            }
            return true
        default:
            guard session.run(action) else {
                return false
            }
        }
        afterChange()
        return true
    }

    private func copySelection(_ session: EditorSession) -> Bool {
        let copied = EditorInput.copied(session.state)
        guard !copied.text.isEmpty else {
            return false
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(copied.text, forType: .string)
        session.lastLinewiseCopy = copied.linewise ? copied.text : nil
        return true
    }

    private func afterChange() {
        redraw()
        scrollToCursor()
    }

    @objc func copy(_ sender: Any?) {
        if let session {
            _ = perform(.copy, session)
        }
    }

    @objc func cut(_ sender: Any?) {
        if let session {
            _ = perform(.cut, session)
        }
    }

    @objc func paste(_ sender: Any?) {
        if let session {
            _ = perform(.paste, session)
        }
    }

    @objc func undo(_ sender: Any?) {
        if let session {
            _ = perform(.undo, session)
        }
    }

    @objc func redo(_ sender: Any?) {
        if let session {
            _ = perform(.redo, session)
        }
    }

    override func selectAll(_ sender: Any?) {
        if let session {
            _ = perform(.selectAll, session)
        }
    }

    // MARK: - Mouse

    func pressed(_ event: NSEvent, at point: NSPoint) {
        window?.makeFirstResponder(self)
        guard let session, let hit = canvas.position(at: canvasPoint(point)) else {
            return
        }
        let state = session.state
        let flags = event.modifierFlags
        let selection: EditorSelection
        switch event.clickCount {
        case 2:
            selection = wordSelection(at: hit.inside, state)
        case 3...:
            let line = state.doc.lineAt(hit.position)
            selection = .single(line.from, min(line.to + 1, state.doc.length))
        default:
            if flags.contains(.shift) {
                selection = state.selection.replacing(.range(state.selection.main.anchor, hit.position))
            } else if flags.contains(.command) {
                selection = state.selection.adding(.cursor(hit.position))
            } else {
                selection = .single(hit.position)
            }
        }
        dragAnchor = (selection.main.anchor, event.clickCount)
        session.dispatch(TransactionSpec(selection: selection, userEvent: "select.pointer"))
        redraw()
    }

    func dragged(to point: NSPoint) {
        guard let session, let anchor = dragAnchor, let hit = canvas.position(at: canvasPoint(point)) else {
            return
        }
        let selection = session.state.selection.replacing(.range(anchor.position, hit.position))
        session.dispatch(TransactionSpec(selection: selection, userEvent: "select.pointer"))
        scrollToCursor()
        redraw()
    }

    /// The word around `position` (CodeMirror's wordAt), or the character there.
    private func wordSelection(at position: Int, _ state: EditorState) -> EditorSelection {
        let line = state.doc.lineAt(position)
        let units = Array(line.text.utf16)
        let extra = Set(state.config.language.wordChars.utf16)
        guard let word = WordMatches.word(in: units, at: position - line.from, extra: extra) else {
            return .single(position, min(position + 1, line.to))
        }
        return .single(line.from + word.lowerBound, line.from + word.upperBound)
    }

    // MARK: - Keys

    /// CodeMirror's name for the key, unshifted ("a", "[", "ArrowLeft", "Enter").
    static func keyName(_ event: NSEvent) -> String {
        switch event.keyCode {
        case 36, 76:
            return "Enter"
        case 48:
            return "Tab"
        case 51:
            return "Backspace"
        case 53:
            return "Escape"
        case 117:
            return "Delete"
        case 123:
            return "ArrowLeft"
        case 124:
            return "ArrowRight"
        case 125:
            return "ArrowDown"
        case 126:
            return "ArrowUp"
        case 115:
            return "Home"
        case 119:
            return "End"
        case 116:
            return "PageUp"
        case 121:
            return "PageDown"
        default:
            let plain = event.characters(byApplyingModifiers: []) ?? event.charactersIgnoringModifiers ?? ""
            return plain.lowercased()
        }
    }

    /// Text a key types: no control characters and none of AppKit's function-key characters.
    static func isPrintable(_ text: String) -> Bool {
        !text.isEmpty && text.unicodeScalars.allSatisfy { scalar in
            scalar.value >= 0x20 && scalar.value != 0x7F && !(0xF700...0xF8FF).contains(scalar.value)
        }
    }
}
