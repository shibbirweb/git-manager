// The file editor's overview ruler (.cm-scroll-markers, scrollMarkers.ts): 12 points of --panel-alt with a 1-point
// --border-strong left border, and a tick per change since the last commit (line_change_marks) in proportion to the
// content's height with the room scrollPastEnd adds (ChangeMarks.ticks), drawn like the diff's ruler.

import NativeCore
import SwiftUI

struct FileRuler: View {
    @Environment(\.theme) private var theme

    let session: EditorSession
    /// EditorModel's revision: new marks or folds draw again.
    let revision: Int

    var body: some View {
        GeometryReader { proxy in
            let ticks = Self.ticks(session, viewport: Double(proxy.size.height))
            ZStack(alignment: .topLeading) {
                theme.color("--panel-alt")
                theme.color("--border-strong").frame(width: 1)
                ForEach([RulerTick.Kind.added, .modified, .deleted], id: \.self) { kind in
                    RulerTicks(ticks: ticks.filter { $0.kind == kind }).fill(color(kind))
                }
            }
        }
        .frame(width: EditorGeometry.rulerWidth)
    }

    static func ticks(_ session: EditorSession, viewport: Double) -> [RulerTick] {
        guard !session.marks.isEmpty else {
            return []
        }
        let doc = session.state.doc
        let layout = FoldLayout(folds: session.state.folds, doc: doc)
        let geometry = EditorGeometry(lineCount: doc.lineCount, widestLine: doc.widestLine,
                                      advance: CodeLineText.advance, rowCount: layout.rowCount)
        return ChangeMarks.ticks(session.marks, layout: layout, lineHeight: EditorGeometry.lineHeight,
                                 contentHeight: geometry.documentHeight(viewport: viewport), trackHeight: viewport)
            .map { tick in
                let kind: RulerTick.Kind
                switch tick.kind {
                case "added":
                    kind = .added
                case "modified":
                    kind = .modified
                default:
                    kind = .deleted
                }
                return RulerTick(top: tick.top, height: tick.height, kind: kind)
            }
    }

    private func color(_ kind: RulerTick.Kind) -> Color {
        switch kind {
        case .added:
            return theme.color("--diff-added-edge")
        case .modified:
            return theme.color("--diff-modified-edge")
        case .deleted:
            return theme.color("--danger")
        }
    }
}
