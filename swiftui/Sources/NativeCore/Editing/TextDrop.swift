// Dropping text into the editor (@codemirror/view's dropText): the text goes in at the drop position, selected; text
// dragged from this editor's own selection is moved (deleted where it was) unless Option is held, which copies it,
// and text from elsewhere is inserted. The deletion and the insertion are one change, the insertion mapped over the
// deletion (so a drop inside the dragged text puts it back where it was).

import Foundation

public enum TextDrop {
    /// The drop's transaction, or nil for no text.
    public static func spec(_ state: EditorState, text: String, at dropPosition: Int, dragged: Range<Int>?,
                            moves: Bool) -> TransactionSpec? {
        let insert = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
        guard !insert.isEmpty else {
            return nil
        }
        let insertion = ChangeSpec(from: dropPosition, insert: insert)
        let deletion = moves ? dragged.map { ChangeSpec(from: $0.lowerBound, to: $0.upperBound) } : nil
        let changes = state.changes(deletion.map { [$0, insertion] } ?? [insertion])
        let selection = EditorSelection.single(changes.map(dropPosition, assoc: -1),
                                               changes.map(dropPosition, assoc: 1))
        return TransactionSpec(changes: changes, selection: selection,
                               userEvent: deletion != nil ? "move.drop" : "input.drop")
    }
}
