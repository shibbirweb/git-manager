// The find bar's actions on the shown file (findPanel.svelte.ts): Cmd+F and Cmd+R open it seeded with a short
// one-line selection, typing jumps to the first match from the cursor, the toggles search again, Next and Previous
// wrap, Replace and Replace All change the text, Exclude skips a match, and Select All Occurrences puts a cursor
// on every match. Next and Previous with no usable search open the bar instead, as CodeMirror's commands do.

import Foundation
import NativeCore

extension EditorModel {
    func openFind(replace: Bool, fromBar: Bool = false) {
        guard let session, !diffActive else {
            return
        }
        let find = session.find, state = session.state
        let main = state.selection.main
        let seeded = FindModel.selectionQuery(state.doc.slice(main.from, main.to), regex: find.options.regex)
        if !find.open {
            find.open = true
            find.anchor = main.from
        }
        find.replaceOpen = replace && !find.readOnly
        if let seeded, !fromBar, seeded != find.search {
            find.search = seeded
            find.excluded = []
        }
        find.count(state)
        find.focus(.find, select: true)
        revision += 1
    }

    /// Escape: closes the bar, forgets the exclusions and gives the editor the keyboard back.
    func closeFind() {
        guard let session, session.find.open else {
            return
        }
        session.find.open = false
        session.find.excluded = []
        session.keyboardRequests += 1
        revision += 1
    }

    func setFindSearch(_ text: String) {
        guard let find = session?.find, text != find.search else {
            return
        }
        find.typed(text)
        applyFind(jump: true, searchChanged: true)
    }

    func setFindReplace(_ text: String) {
        session?.find.replace = text
    }

    func toggleFind(_ option: WritableKeyPath<FindOptions, Bool>) {
        session?.find.options[keyPath: option].toggle()
        applyFind(jump: true, searchChanged: true)
    }

    func toggleReplaceRow() {
        guard let find = session?.find else {
            return
        }
        find.replaceOpen = !find.replaceOpen && !find.readOnly
        find.focus(find.replaceOpen ? .replace : .find, select: false)
    }

    /// The fields into the search; typing also jumps to the first match from the anchor.
    private func applyFind(jump: Bool, searchChanged: Bool) {
        guard let session else {
            return
        }
        let find = session.find
        if searchChanged && !find.excluded.isEmpty {
            find.excluded = []
        }
        if jump && searchChanged && find.query.valid,
           let match = FindModel.firstMatch(session.state, find.query, from: find.anchor) {
            session.dispatch(TransactionSpec(selection: .single(match.lowerBound, match.upperBound),
                                             userEvent: FindState.typingEvent, scrollIntoView: true))
            session.scrollMargin = 48
            session.scrollRequests += 1
        } else {
            find.count(session.state)
        }
        revision += 1
    }

    func findNext(forward: Bool = true) {
        guard let session, !diffActive else {
            return
        }
        guard session.find.query.valid else {
            openFind(replace: false)
            return
        }
        let state = session.state
        let spec = forward ? EditorCommands.findNext(state, session.find.query)
            : EditorCommands.findPrevious(state, session.find.query)
        if let spec {
            session.dispatch(spec)
            session.scrollRequests += 1
        }
    }

    func replaceOne() {
        guard let session, !session.find.readOnly, session.find.query.valid,
              let spec = EditorCommands.replaceNext(session.state, session.find.query) else {
            return
        }
        session.dispatch(spec)
        session.scrollRequests += 1
    }

    func replaceAll() {
        guard let session, !session.find.readOnly, session.find.query.valid,
              let replaced = EditorCommands.replaceAll(session.state, session.find.query) else {
            return
        }
        session.dispatch(replaced.spec)
        session.find.notice = "\(replaced.count.formatted()) replaced"
    }

    /// Skips the selected match for this search (Replace All leaves it too) and goes to the next.
    func excludeMatch() {
        guard let session else {
            return
        }
        let main = session.state.selection.main
        let query = session.find.query
        if query.valid, main.from < main.to,
           query.matches(in: session.state.doc, from: main.from, to: main.to, limit: 1).first == main.from..<main.to {
            session.find.excluded.append(main.from..<main.to)
        }
        findNext()
    }

    /// Select All Occurrences: every match of the open bar's search (the editor takes the keyboard), else every
    /// occurrence of the selection or of the word at the cursor.
    func selectAllMatches() {
        guard let session, !diffActive else {
            return
        }
        let find = session.find
        guard find.open && find.query.valid else {
            if session.run(.selectAllOccurrences) {
                session.keyboardRequests += 1
            }
            return
        }
        if let spec = EditorCommands.selectMatches(session.state, find.query) {
            session.dispatch(spec)
            session.keyboardRequests += 1
        } else if FindModel.count(session.state, find.query, cap: FindModel.selectCap).capped {
            context.toasts.show(.info, "Too many matches to select",
                                detail: "Select All Occurrences works up to 1,000 matches.")
        }
    }
}
