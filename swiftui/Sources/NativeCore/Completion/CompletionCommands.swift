// The completion keys' commands (@codemirror/autocomplete): moving the selection by one or by a page, picking the
// selected option and closing. A key does nothing (and goes on to the editor) while no popup is open, while it is
// disabled, or during the first 75 ms after it opened, so a key pressed as the popup appears is not swallowed.
// Picking inserts the option's text over the typed range at every cursor that has the same text there.

import Foundation

public enum CompletionCommands {
    /// interactionDelay, in milliseconds.
    public static let interactionDelay = 75.0

    /// The option to select after Up or Down (`pageRows` nil) or Page Up or Down, or nil when the key is not for
    /// the popup. `pageRows` is the popup's height in rows (tooltip height / row height, rounded down).
    public static func move(_ completion: CompletionState, forward: Bool, pageRows: Int? = nil, now: Double)
        -> Int? {
        guard let open = completion.open, !open.disabled, now - open.timestamp >= interactionDelay else {
            return nil
        }
        let step = pageRows.map { max(2, $0 - 1) } ?? 1
        let length = open.options.count
        var selected = open.selected > -1 ? open.selected + step * (forward ? 1 : -1) : forward ? 0 : length - 1
        if selected < 0 {
            selected = pageRows != nil ? 0 : length - 1
        } else if selected >= length {
            selected = pageRows != nil ? length - 1 : 0
        }
        return selected
    }

    /// The option Enter or Tab picks, or nil when the key is not for the popup.
    public static func acceptable(_ completion: CompletionState, now: Double, readOnly: Bool = false)
        -> CompletionOption? {
        guard !readOnly, let open = completion.open, open.selected >= 0, !open.disabled,
              now - open.timestamp >= interactionDelay else {
            return nil
        }
        return open.options[open.selected]
    }

    /// The result an option came from, which gives the range it replaces.
    public static func result(of option: CompletionOption, in completion: CompletionState) -> ActiveCompletion? {
        completion.active.first { $0.source == option.source && $0.hasResult }
    }

    /// insertCompletionText: `text` over `from`..`to` at the main cursor, and over the same offsets around every
    /// other cursor whose text there is the same.
    public static func insertText(_ state: EditorState, _ text: String, from: Int, to: Int) -> TransactionSpec {
        let main = state.selection.main
        let fromOff = from - main.from, toOff = to - main.from
        let insert = text.replacingOccurrences(of: "\r\n", with: "\n")
        let length = insert.utf16.count
        let typed = state.sliceDoc(from, to)
        var spec = state.changeByRange { range in
            if range != main && from != to && state.sliceDoc(range.from + fromOff, range.from + toOff) != typed {
                return EditorState.RangeChange(range: range)
            }
            let end = to == main.from ? range.to : range.from + toOff
            return EditorState.RangeChange(
                changes: [ChangeSpec(from: range.from + fromOff, to: end, insert: insert)],
                range: .cursor(range.from + fromOff + length)
            )
        }
        spec.scrollIntoView = true
        spec.userEvent = "input.complete"
        return spec
    }

    /// rangeAroundSelected: the slice of the options the popup renders (at most `max`), around the selected one.
    public static func renderedRange(total: Int, selected: Int, max: Int = 100) -> Range<Int> {
        if total <= max {
            return 0..<total
        }
        let selected = Swift.max(0, selected)
        if selected <= total >> 1 {
            let off = selected / max
            return off * max..<(off + 1) * max
        }
        let off = Int((Double(total - selected) / Double(max)).rounded(.up))
        return total - off * max..<total - (off - 1) * max
    }
}
