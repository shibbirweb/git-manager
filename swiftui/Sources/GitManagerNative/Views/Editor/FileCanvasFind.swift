// The find bar's matches in the editor while it is open (@codemirror/search's highlighter, setup.ts): each match on
// the rows shown in --warning at 30%, a match that is also selected at 62% with a 1-point --warning outline at 85%
// around it, in the same box as the selection-match tints. WebKit premultiplies with the exact share and
// rounds only the stored alpha (30%: 55, 38, 13 over 77, not 56, 39, 13).

import AppKit
import NativeCore

extension FileCanvas {
    /// Returns the matches drawn, which hide the selection-match tints inside them.
    func drawFindMatches(_ content: Content, shown: Range<Int>, colors: CanvasColors,
                         scale: CGFloat) -> [Range<Int>] {
        guard let query = content.findQuery, !shown.isEmpty else {
            return []
        }
        var drawn: [Range<Int>] = []
        let doc = content.doc
        let first = content.layout.lines(forRow: shown.lowerBound).lowerBound
        let last = content.layout.lines(forRow: shown.upperBound - 1).upperBound
        let from = doc.line(first).from, to = doc.line(min(last, doc.lineCount - 1)).to
        let selected = Set(content.state.selection.ranges.filter { !$0.isEmpty }.map { $0.from..<$0.to })
        let warning = colors.exact("--warning")
        for match in query.matches(in: doc, from: from, to: to, limit: 1000) {
            let row = row(of: match.lowerBound, content)
            guard shown.contains(row) else {
                continue
            }
            drawn.append(match)
            if selected.contains(match) {
                outline(match, row: row, color: warning, alpha: 0.85, content, scale: scale)
                blendBox(warning, alpha: 0.62, row: row, range: match, content, scale: scale)
            } else {
                blendBox(warning, alpha: 0.3, row: row, range: match, content, scale: scale)
            }
        }
        return drawn
    }

    /// A 1-point ring just outside the match's box (CSS outline).
    private func outline(_ range: Range<Int>, row: Int, color: [Double], alpha: Double, _ content: Content,
                         scale: CGFloat) {
        let textX = self.textX(content)
        let left = ((textX + x(of: range.lowerBound, row: row, content)) * scale).rounded()
        let right = ((textX + x(of: range.upperBound, row: row, content)) * scale).rounded()
        let top = ((rowTop(row) - 1) * scale).rounded(), bottom = top + 17 * scale
        let clip = pixelBand(scale)
        let edges = [
            CGRect(x: left - scale, y: top - scale, width: right - left + 2 * scale, height: scale),
            CGRect(x: left - scale, y: bottom, width: right - left + 2 * scale, height: scale),
            CGRect(x: left - scale, y: top, width: scale, height: bottom - top),
            CGRect(x: right, y: top, width: scale, height: bottom - top),
        ]
        for edge in edges {
            let area = edge.intersection(clip)
            if !area.isNull {
                surface.blend(color, alpha: alpha, in: area)
            }
        }
    }
}
