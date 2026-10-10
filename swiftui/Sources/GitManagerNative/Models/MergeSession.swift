// One open merge (MergeEditor.svelte's state): the three texts, the result's lines and chunks with their undo
// history, the result line the cursor is on, the word-level marks of the sides and the syntax colors. The logic is
// MergeModel in NativeCore; this keeps it for the window. The result is shown but not typed in yet.

import Foundation
import NativeCore

@MainActor
final class MergeSession: ObservableObject {
    struct Snapshot: Equatable {
        let lines: [String]
        let chunks: [ChunkState]
    }

    let document: MergeDocumentDTO
    let sides: MergeSides
    let baseLines: [String]
    @Published private(set) var lines: [String]
    @Published private(set) var chunks: [ChunkState]
    /// The result line the cursor is on (0-based): its line and gutter take the active-line color.
    @Published private(set) var cursorLine = 0
    /// Asks the panes to center a result line; a new token asks again.
    @Published private(set) var reveal: (token: Int, line: Int)?
    @Published private(set) var oursSpans: SyntaxColors?
    @Published private(set) var theirsSpans: SyntaxColors?
    @Published private(set) var resultSpans: SyntaxColors?
    @Published var saving = false
    private var undoStack: [Snapshot] = []
    private var redoStack: [Snapshot] = []
    private var inlineCache: [String: [Range<Int>]?] = [:]
    private var highlightGeneration = 0

    init(document: MergeDocumentDTO) {
        self.document = document
        sides = MergeSides(ours: MergeText.lines(document.ours), theirs: MergeText.lines(document.theirs))
        baseLines = MergeText.lines(document.base)
        lines = baseLines
        chunks = MergeModel.initialChunks(document.chunks)
        if let first = MergeNavigation.findUnresolved(chunks, fromLine: -1, direction: 1) {
            cursorLine = min(first.result.start, lines.count - 1)
            reveal = (1, cursorLine)
        }
    }

    var fileName: String {
        (document.path as NSString).lastPathComponent
    }

    var counts: ResolutionCounts {
        MergeNavigation.unresolvedCounts(chunks)
    }

    var nonConflicting: Int {
        MergeNavigation.nonConflictingCount(chunks)
    }

    var canUndo: Bool {
        !undoStack.isEmpty
    }

    var canRedo: Bool {
        !redoStack.isEmpty
    }

    var resultText: String {
        MergeText.text(lines)
    }

    /// Colors all three texts with the current app's grammars, off the main thread.
    func highlight() async {
        let filePath = document.path
        async let ours = SyntaxHighlighter.shared.spans(filePath: filePath, text: document.ours)
        async let theirs = SyntaxHighlighter.shared.spans(filePath: filePath, text: document.theirs)
        let sideSpans = await (ours, theirs)
        oursSpans = sideSpans.0
        theirsSpans = sideSpans.1
        await highlightResult()
    }

    private func highlightResult() async {
        highlightGeneration += 1
        let generation = highlightGeneration
        let spans = await SyntaxHighlighter.shared.spans(filePath: document.path, text: resultText)
        if generation == highlightGeneration {
            resultSpans = spans
        }
    }

    func apply(_ chunkId: Int, side: MergeSide) {
        commit(MergeModel.applySide(lines, chunks: chunks, chunkId: chunkId, side: side, sides: sides))
    }

    func ignore(_ chunkId: Int, side: MergeSide) {
        commit(MergeModel.ignoreSide(lines, chunks: chunks, chunkId: chunkId, side: side))
    }

    func applyNonConflicting(only side: MergeSide? = nil) {
        commit(MergeModel.applyNonConflicting(lines, chunks: chunks, sides: sides, only: side))
    }

    func acceptWhole(_ side: MergeSide) {
        commit(MergeModel.acceptWholeSide(chunks: chunks, sides: sides, side: side))
    }

    func undo() {
        guard let previous = undoStack.popLast() else {
            return
        }
        redoStack.append(Snapshot(lines: lines, chunks: chunks))
        restore(previous)
    }

    func redo() {
        guard let next = redoStack.popLast() else {
            return
        }
        undoStack.append(Snapshot(lines: lines, chunks: chunks))
        restore(next)
    }

    /// The next (1) or previous (-1) unresolved chunk from the cursor, centered (F7 and Shift+F7).
    func navigate(_ direction: Int) {
        guard let target = MergeNavigation.findUnresolved(chunks, fromLine: cursorLine, direction: direction) else {
            return
        }
        cursorLine = min(target.result.start, lines.count - 1)
        reveal = ((reveal?.token ?? 0) + 1, cursorLine)
    }

    /// The word-level changes inside a side's chunk, as UTF-16 ranges from the chunk's first line (computed once:
    /// the sides never change).
    func inlineSpans(_ chunk: ChunkState, side: MergeSide) -> [Range<Int>]? {
        let key = "\(side.rawValue):\(chunk.id)"
        if let cached = inlineCache[key] {
            return cached
        }
        let range = chunk.range(side), otherRange = chunk.range(side.other)
        var reference: String?
        if !chunk.base.isEmpty {
            reference = MergeText.slice(baseLines, chunk.base).joined(separator: "\n")
        } else if chunk.kind == .conflict && !otherRange.isEmpty {
            // With no base text (both added), compare against the other side.
            reference = MergeText.slice(sides.lines(side.other), otherRange).joined(separator: "\n")
        }
        var spans: [Range<Int>]?
        if !range.isEmpty, let reference {
            spans = WordDiff.changedSpans(before: reference, after: MergeText.slice(sides.lines(side), range)
                .joined(separator: "\n"))
        }
        inlineCache[key] = spans
        return spans
    }

    private func commit(_ action: MergeAction?) {
        guard let action else {
            return
        }
        undoStack.append(Snapshot(lines: lines, chunks: chunks))
        redoStack.removeAll()
        apply(action.lines, action.chunks)
    }

    private func restore(_ snapshot: Snapshot) {
        apply(snapshot.lines, snapshot.chunks)
    }

    private func apply(_ nextLines: [String], _ nextChunks: [ChunkState]) {
        let textChanged = nextLines != lines
        lines = nextLines
        chunks = nextChunks
        cursorLine = min(cursorLine, lines.count - 1)
        if textChanged {
            Task {
                await highlightResult()
            }
        }
    }
}
