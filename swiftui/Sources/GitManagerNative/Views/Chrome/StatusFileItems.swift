// The status bar's file items (StatusBar.svelte fileInfo): the shown file's cursor ("Ln 1, Col 1", with "(7 selected,
// 2 lines)" while text is selected), indentation, line ends and language, before the bell. A view of their own
// that follows every change of the editor (EditorChanges), so a cursor move renders these items, not the whole
// bar. Its items join the bar's row as if written there (a Group adds no stack of its own).

import NativeCore
import SwiftUI

struct StatusFileItems: View {
    @EnvironmentObject private var editor: EditorModel
    @EnvironmentObject private var changes: EditorChanges
    @EnvironmentObject private var diffs: DiffStore

    private var items: [String] {
        guard let file = editor.file, !editor.diffActive || diffs.openDiff == nil else {
            return []
        }
        // FileView.svelte: the main selection's head, its line, and its UTF-16 offset in that line.
        let main = editor.session?.state.selection.main
        let head = main?.head ?? 0
        let line = editor.session?.state.doc.lineAt(head)
        var position = "Ln \((line?.index ?? 0) + 1), Col \(head - (line?.from ?? 0) + 1)"
        if let main, let doc = editor.session?.state.doc, !main.isEmpty {
            let lines = doc.lineAt(main.to).index - doc.lineAt(main.from).index + 1
            position += " (\(main.to - main.from) selected\(lines > 1 ? ", \(lines) lines" : ""))"
        }
        return [position, EditorInfo.indentLabel(file.indent), file.eolLabel, file.language]
    }

    var body: some View {
        let items = items
        Group {
            ForEach(Array(items.enumerated()), id: \.offset) { _, text in
                ExactText(text: text)
                    .padding(.horizontal, 7)
                    .frame(height: 20)
            }
            if !items.isEmpty {
                // .gap: 6 points after the file's items.
                Color.clear.frame(width: 6, height: 1)
            }
        }
    }
}
