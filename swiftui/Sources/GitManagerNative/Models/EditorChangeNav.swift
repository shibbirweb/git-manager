// The file bar's previous and next change (FileView.svelte goToSection, navigation.ts sectionTarget): the cursor goes
// to the first line of the change after the cursor's line (or the one before the change it is in), wrapping, and
// the editor centers it and takes the keyboard.

import NativeCore

extension EditorModel {
    func goToChange(forward: Bool) {
        guard let session else {
            return
        }
        let doc = session.state.doc
        let line = doc.lineAt(session.state.selection.main.head).index
        guard let target = ChangeMarks.target(session.marks, from: line, forward: forward) else {
            return
        }
        let position = doc.line(min(target.from, doc.lineCount - 1)).from
        session.dispatch(TransactionSpec(selection: .single(position), userEvent: "select", scrollIntoView: true))
        session.centerRequests += 1
    }

    /// The file bar's change label: "No changes", "2 changes", "1 of 2" with the cursor in one.
    var changeLabel: String {
        guard let session else {
            return "No changes"
        }
        let line = session.state.doc.lineAt(session.state.selection.main.head).index
        return ChangeMarks.label(session.marks, cursorLine: line)
    }
}
