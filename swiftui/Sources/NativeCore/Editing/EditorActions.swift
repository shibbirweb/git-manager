// Runs an EditorAction against a state: the transaction it makes, or nil when it does nothing (CodeMirror's command
// returning false, so the next binding for the key gets its turn). Copy, cut, paste and save are the window's.

import Foundation

public struct EditorContext: Sendable {
    public var style: IndentStyle
    public var foldRanges: FoldRanges
    /// Rows a page holds (the viewport less 5 points, in 16-point rows).
    public var pageRows: Int
    public var time: Double

    public init(style: IndentStyle = .none, foldRanges: FoldRanges = FoldRanges(), pageRows: Int = 30,
                time: Double = Date().timeIntervalSince1970 * 1000) {
        self.style = style
        self.foldRanges = foldRanges
        self.pageRows = pageRows
        self.time = time
    }
}

public enum EditorActions {
    public static func run(_ action: EditorAction, _ state: EditorState, _ context: EditorContext) -> Transaction? {
        switch action {
        case .undo:
            return state.undo(time: context.time)
        case .redo:
            return state.redo(time: context.time)
        case .undoSelection:
            return state.undo(onlySelection: true, time: context.time)
        case .redoSelection:
            return state.redo(onlySelection: true, time: context.time)
        case .copy, .cut, .paste, .save:
            return nil
        default:
            return spec(action, state, context).map { state.update($0, time: context.time) }
        }
    }

    static func spec(_ action: EditorAction, _ state: EditorState, _ context: EditorContext) -> TransactionSpec? {
        typealias Commands = EditorCommands
        switch action {
        case .cursorCharLeft, .cursorCharRight:
            return Commands.cursorChar(state, forward: action == .cursorCharRight)
        case .selectCharLeft, .selectCharRight:
            return Commands.selectChar(state, forward: action == .selectCharRight)
        case .cursorGroupLeft, .cursorGroupRight:
            return Commands.cursorGroup(state, forward: action == .cursorGroupRight)
        case .selectGroupLeft, .selectGroupRight:
            return Commands.selectGroup(state, forward: action == .selectGroupRight)
        case .cursorLineBoundaryLeft, .cursorLineBoundaryRight:
            return Commands.cursorLineBoundary(state, forward: action == .cursorLineBoundaryRight)
        case .selectLineBoundaryLeft, .selectLineBoundaryRight:
            return Commands.selectLineBoundary(state, forward: action == .selectLineBoundaryRight)
        case .cursorLineUp, .cursorLineDown:
            return Commands.cursorLine(state, forward: action == .cursorLineDown)
        case .selectLineUp, .selectLineDown:
            return Commands.selectLine(state, forward: action == .selectLineDown)
        case .cursorDocStart, .cursorDocEnd:
            return Commands.cursorDoc(state, end: action == .cursorDocEnd)
        case .selectDocStart, .selectDocEnd:
            return Commands.selectDoc(state, end: action == .selectDocEnd)
        case .cursorPageUp, .cursorPageDown:
            return Commands.cursorPage(state, forward: action == .cursorPageDown, rows: context.pageRows)
        case .selectPageUp, .selectPageDown:
            return Commands.selectPage(state, forward: action == .selectPageDown, rows: context.pageRows)
        case .cursorLineStart, .cursorLineEnd, .selectLineStart, .selectLineEnd:
            return Commands.cursorLineEdge(state, forward: action == .cursorLineEnd || action == .selectLineEnd,
                                           extend: action == .selectLineStart || action == .selectLineEnd)
        case .insertNewlineAndIndent, .insertBlankLine:
            return Commands.newlineAndIndent(state, style: context.style, atEnd: action == .insertBlankLine)
        case .selectAll:
            return Commands.selectAll(state)
        case .selectLine:
            return Commands.selectLines(state)
        case .simplifySelection:
            return Commands.simplifySelection(state)
        case .deleteCharBackward, .deleteCharForward:
            return Commands.deleteChar(state, forward: action == .deleteCharForward)
        case .deleteGroupBackward, .deleteGroupForward:
            return Commands.deleteGroup(state, forward: action == .deleteGroupForward)
        case .deleteLineBoundaryBackward, .deleteLineBoundaryForward:
            return Commands.deleteLineBoundary(state, forward: action == .deleteLineBoundaryForward)
        case .deleteToLineEnd:
            return Commands.deleteToLineEnd(state)
        case .splitLine:
            return Commands.splitLine(state)
        case .moveLineUp, .moveLineDown:
            return Commands.moveLine(state, forward: action == .moveLineDown)
        case .copyLineUp, .copyLineDown:
            return Commands.copyLine(state, forward: action == .copyLineDown)
        case .addCursorAbove, .addCursorBelow:
            return Commands.addCursorVertically(state, forward: action == .addCursorBelow)
        case .indentMore:
            return Commands.indentMore(state)
        case .indentLess:
            return Commands.indentLess(state)
        case .deleteLine:
            return Commands.deleteLine(state)
        case .toggleComment:
            return Commands.toggleComment(state)
        case .toggleBlockComment:
            return Commands.toggleBlockComment(state, byLine: false)
        case .selectNextOccurrence:
            return Commands.selectNextOccurrence(state)
        case .selectAllOccurrences:
            return Commands.selectAllOccurrences(state)
        case .duplicate:
            return Commands.duplicate(state)
        case .joinLines:
            return Commands.joinLines(state)
        case .toggleCase:
            return Commands.toggleCase(state)
        case .sortLines:
            return Commands.sortLines(state)
        case .foldCode:
            return state.foldCode(context.foldRanges)
        case .unfoldCode:
            return state.unfoldCode()
        case .foldAll:
            return state.foldAll(context.foldRanges)
        case .unfoldAll:
            return state.unfoldAll()
        case .deleteBracketPair:
            return CloseBrackets.deletePair(state)
        case .undo, .redo, .undoSelection, .redoSelection, .copy, .cut, .paste, .save:
            return nil
        }
    }
}

extension EditorCommands {
    /// Ctrl+K (deleteToLineEnd): to the line's end, or the line break when already there.
    public static func deleteToLineEnd(_ state: EditorState) -> TransactionSpec? {
        deleteBy(state) { range in
            let lineEnd = state.lineBlock(at: range.head).to
            return range.head < lineEnd ? lineEnd : min(state.doc.length, range.head + 1)
        }
    }
}
