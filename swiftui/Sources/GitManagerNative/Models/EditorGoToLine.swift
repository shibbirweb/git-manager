// Code > Go to Line (Cmd+L, editorCommands.ts promptGoToLine): asks for "line" or "line:column", starting from the
// cursor's, then puts the cursor there, centered; the editor takes the keyboard again either way.

import NativeCore

extension EditorModel {
    func goToLine() async {
        guard let session else {
            return
        }
        let lineCount = session.state.doc.lineCount
        let answer = await context.dialogs.ask(DialogCenter.Prompt(
            title: "Go to Line", label: "Line[:column] (1-\(lineCount))",
            initial: EditorCommands.lineTargetText(session.state), confirmLabel: "Go",
            validate: { text in
                EditorCommands.parseLineTarget(text, lineCount: lineCount) == nil
                    ? "Enter a line number, optionally with :column" : nil
            }
        ))
        // The file may have closed while the dialog was open.
        guard session === self.session else {
            return
        }
        if let answer, let target = EditorCommands.parseLineTarget(answer, lineCount: session.state.doc.lineCount) {
            let position = EditorCommands.lineTargetPosition(session.state.doc, line: target.line,
                                                             column: target.column)
            session.dispatch(TransactionSpec(selection: .single(position), userEvent: "select", scrollIntoView: true))
        }
        session.centerRequests += 1
    }
}
