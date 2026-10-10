// Go to Line's input (src/lib/editor/textCommands.ts parseLineTarget and lineTargetPosition): "42", "42:7" or
// "42,7", the line kept inside the document and the column at least 1; the column stops at the end of the line.

import Foundation

extension EditorCommands {
    public static func parseLineTarget(_ text: String, lineCount: Int) -> (line: Int, column: Int)? {
        let pattern = #"^\s*(\d+)\s*(?:[:,]\s*(\d+)\s*)?$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let found = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let lineRange = Range(found.range(at: 1), in: text), let line = Int(text[lineRange]) else {
            return nil
        }
        let column = Range(found.range(at: 2), in: text).flatMap { Int(text[$0]) } ?? 1
        return (min(max(1, line), max(1, lineCount)), max(1, column))
    }

    /// The document position of a target from parseLineTarget.
    public static func lineTargetPosition(_ doc: TextDocument, line: Int, column: Int) -> Int {
        let target = doc.line(min(max(1, line), doc.lineCount) - 1)
        return target.from + min(column - 1, target.to - target.from)
    }

    /// The prompt's text at start: the cursor's line and column, 1-based ("12:5").
    public static func lineTargetText(_ state: EditorState) -> String {
        let head = state.selection.main.head
        let line = state.doc.lineAt(head)
        return "\(line.index + 1):\(head - line.from + 1)"
    }
}
