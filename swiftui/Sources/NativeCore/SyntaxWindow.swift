// How much of a text to color first. CodeMirror parses up to the viewport before the rest, so a long file shows
// its colors at once; the native app's highlighter parses from the start too, so a first pass stops a margin past
// the lines a new diff shows (it centers the first change) and a second pass colors the whole text.

import Foundation

public enum SyntaxWindow {
    /// Lines past the first change that the first pass covers: more than half the tallest viewport.
    public static let margin = 150

    /// The UTF-16 offset where 0-based line `line + margin` ends, or nil when the first pass would cover most of
    /// the text anyway (one whole pass is then cheaper than two).
    public static func firstPassEnd(_ text: String, line: Int, margin: Int = margin) -> Int? {
        let utf16 = text.utf16
        let target = max(0, line) + margin
        var lines = 0
        var offset = 0
        for unit in utf16 {
            offset += 1
            if unit == 10 {
                lines += 1
                if lines > target {
                    return offset * 2 < utf16.count ? offset : nil
                }
            }
        }
        return nil
    }

    /// Each side's first pass end for a diff, from its first change.
    public static func diffEnds(original: String, modified: String, hunks: [DiffHunk]) -> (original: Int?,
                                                                                           modified: Int?) {
        let first = hunks.first
        return (firstPassEnd(original, line: first?.oldStart ?? 0), firstPassEnd(modified, line: first?.newStart ?? 0))
    }
}
