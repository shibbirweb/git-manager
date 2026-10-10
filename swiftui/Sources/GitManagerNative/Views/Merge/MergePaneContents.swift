// Builds each merge pane's canvas content from the session, once per change: the rows, their decorations, the
// syntax colors and the indent guides. The sides never change, so their rows and guides are made once; the result's
// follow its lines.

import AppKit
import NativeCore

@MainActor
final class MergePaneContents: ObservableObject {
    static let metrics = RowMetrics(line: 16, fold: 22, padding: 4)

    private struct Built {
        let lines: [String]
        let rows: [DiffRow]
        let index: RowIndex
        let guides: [IndentGuides.Run]
        let lineStarts: [Int]
        let lengths: [Int]
        let gutter: CGFloat
    }

    private var built: [MergePane: Built] = [:]

    func content(_ pane: MergePane, session: MergeSession, theme: Theme) -> MergePaneCanvas.Content {
        let lines: [String]
        let marks: [MergeLineMark]
        let spans: SyntaxColors?
        switch pane {
        case .ours:
            lines = session.sides.ours
            marks = MergeNavigation.sideMarks(session.chunks, side: .ours)
            spans = session.oursSpans
        case .theirs:
            lines = session.sides.theirs
            marks = MergeNavigation.sideMarks(session.chunks, side: .theirs)
            spans = session.theirsSpans
        case .result:
            lines = session.lines
            marks = MergeNavigation.resultMarks(session.chunks)
            spans = session.resultSpans
        }
        let rows = rowsFor(pane, lines: lines)
        let side: MergeSide? = pane == .ours ? .ours : (pane == .theirs ? .theirs : nil)
        let chunks = Dictionary(uniqueKeysWithValues: session.chunks.map { ($0.id, $0) })
        let styles = MergePaneLayout.styles(lines: lines, marks: marks) { mark in
            guard let side, let chunk = chunks[mark.chunkId] else {
                return nil
            }
            return session.inlineSpans(chunk, side: side)
        }
        return MergePaneCanvas.Content(
            lines: lines, index: rows.index, styles: styles, spans: spans, lineStarts: rows.lineStarts,
            guides: rows.guides, activeLine: pane == .result ? session.cursorLine : nil,
            // A side's cursor stays at the start; the result's at its first chunk.
            matchWord: WordMatches.word(at: 0, in: pane == .result ? lines[min(session.cursorLine, lines.count - 1)]
                : lines[0]),
            lineLengths: rows.lengths, gutterWidth: rows.gutter, theme: theme
        )
    }

    /// Lines that change compare as arrays, which costs little next to rebuilding; equal arrays share storage.
    private func rowsFor(_ pane: MergePane, lines: [String]) -> Built {
        if let built = built[pane], built.lines == lines {
            return built
        }
        let rows = lines.enumerated().map { DiffRow.line(number: $0.offset + 1, text: $0.element, kind: .unchanged) }
        let levels = IndentGuides.levels(lines: lines)
        let next = Built(
            lines: lines, rows: rows, index: RowIndex(rows: rows, metrics: Self.metrics),
            guides: IndentGuides.runs(rows: rows, levels: levels, metrics: Self.metrics),
            lineStarts: MergeText.lineStarts(MergeText.text(lines)),
            lengths: lines.map { $0.utf16.count },
            gutter: max(MergePaneCanvas.minGutterWidth, 22 + CGFloat(String(lines.count).count) * CodeLineText.advance)
        )
        built[pane] = next
        return next
    }
}
