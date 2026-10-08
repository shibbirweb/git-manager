// The Log's mixed colors (LogView.svelte's .ref rules, GraphCell.svelte's lanes), worked out as WebKit does:
// color-mix() in sRGB before the conversion to Display P3, translucent borders blended over the label's own fill.

import AppKit
import NativeCore
import SwiftUI

struct RefLook {
    let fill: Color
    let border: Color
    let text: Color
    let bold: Bool
}

extension Theme {
    /// A graph lane's color (LANE_COLORS), the same in light and dark.
    func laneColor(_ index: Int) -> Color {
        Color(nsColor: Theme.parse(LogGraphCell.laneColors[LogGraphCell.colorIndex(index)]) ?? .gray)
    }

    /// A ref label's colors on a row painted `rowBackground` (--panel, --hover or --selected-inactive): the kind's
    /// color at 14% over the row, its 45% border over that, its text 80% toward --text; HEAD's branch is solid accent.
    func refLook(kind: String, on rowBackground: String) -> RefLook {
        if kind == "head" {
            return RefLook(fill: color("--accent"), border: color("--accent"), text: ink("--accent-text"), bold: true)
        }
        guard let base = refBase(kind), let row = cssColor(rowBackground), let text = cssColor("--text") else {
            return RefLook(fill: .clear, border: .clear, text: ink("--text-dim"), bold: false)
        }
        let fill = base.mixed(0.14, with: row)
        // Each row is a composited layer on the page (translateY): its fill's converted color passes through half
        // precision before it is stored, which turns 235.507 (remote) and 226.509 (local) red down, not up.
        let stored = fill.p3Exact.map { (GlyphCompositor.half($0 / 255) * 255).rounded() }
        return RefLook(
            fill: Color(nsColor: CSSColor.color(p3Bytes: stored)),
            border: Color(nsColor: base.over(fill, opacity: 0.45)),
            text: Color(nsColor: base.mixed(0.8, with: text).displayP3Exact),
            bold: false
        )
    }

    /// --ref-color for each kind of label.
    private func refBase(_ kind: String) -> CSSColor? {
        switch kind {
        case "local":
            return cssColor("--success")
        case "remote":
            guard let accent = cssColor("--accent"), let violet = CSSColor.parse("#b04ad8") else {
                return nil
            }
            return accent.mixed(0.45, with: violet)
        case "tag":
            return cssColor("--warning")
        default:
            return cssColor("--text-dim")
        }
    }
}
