// One commit in the Log list (LogView.svelte's .row), measured in swiftui/Reference/log-<mode>/log-rows.json and
// log-labels.json: 26 points tall, the graph column, the subject with up to three ref labels and a "+N" one, then the
// 150-point author, 110-point date and 82-point hash columns (12 points in), 10 points of padding at the end.

import AppKit
import NativeCore
import SwiftUI

struct LogRowView: View {
    @Environment(\.theme) private var theme

    static let maxBadges = 3
    static let hashFont = monoFont(11.5)

    /// The page's --font-mono: JetBrains Mono.
    static func monoFont(_ size: CGFloat) -> NSFont {
        NSFont(name: "JetBrainsMono-Regular", size: size) ?? .monospacedSystemFont(ofSize: size, weight: .regular)
    }

    let commit: CommitSummary
    let row: GraphRow
    let graphWidth: CGFloat
    let selected: Bool
    let hovered: Bool
    var nodeOnly = false
    let date: String

    /// .row.selected comes after .row:hover in the page's CSS.
    private var background: String {
        if selected {
            return "--selected-inactive"
        }
        return hovered ? "--hover" : "--panel"
    }

    var body: some View {
        let refs = LogFormat.sortRefs(commit.refs, kind: \.kind)
        let isHead = commit.refs.contains { $0.kind == "head" }
        HStack(spacing: 0) {
            GraphCellView(
                row: row, width: graphWidth, isHead: isHead, isMerge: commit.parents.count > 1, nodeOnly: nodeOnly,
                rowBackground: background
            )
            HStack(spacing: 4) {
                ForEach(Array(refs.prefix(Self.maxBadges).enumerated()), id: \.offset) { _, ref in
                    RefBadge(name: ref.name, kind: ref.kind, rowBackground: background)
                }
                if refs.count > Self.maxBadges {
                    RefBadge(name: "+\(refs.count - Self.maxBadges)", kind: "more", rowBackground: background)
                }
                // After labels of fractional widths: ExactText sets the glyphs at the page's fraction.
                ExactText(text: commit.summary, size: 13, weight: isHead ? .semibold : .regular)
                    .foregroundStyle(theme.ink("--text"))
                    .layoutPriority(-1)
                Spacer(minLength: 0)
            }
            .padding(.leading, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            column(commit.authorName, width: 150)
            column(date, width: 110)
            Text(commit.shortId)
                .font(Font(Self.hashFont))
                .foregroundStyle(theme.ink("--text-faint"))
                .lineLimit(1)
                .padding(.leading, 12)
                .frame(width: 82, alignment: .leading)
                .clipped()
        }
        .padding(.trailing, 10)
        .frame(height: LogList.rowHeight)
        .background(theme.color(background))
    }

    private func column(_ text: String, width: CGFloat) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(theme.ink("--text-dim"))
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.leading, 12)
            .frame(width: width, alignment: .leading)
    }
}

/// A branch or tag label (.ref): 17 points tall, 6 points of padding, 4-point corners, 11-point text on a 15-point
/// line, a 10-point tag icon 3 points before a tag's name, at most 180 points wide.
struct RefBadge: View {
    @Environment(\.theme) private var theme

    let name: String
    let kind: String
    let rowBackground: String

    var body: some View {
        let look = theme.refLook(kind: kind, on: rowBackground)
        HStack(spacing: 3) {
            if kind == "tag" {
                Icon(name: "tag", size: 10)
            }
            ExactText(text: name, size: 11, weight: look.bold ? .bold : .regular)
                // 11-point text on its 15-point line sits half a point lower on the page (measured).
                .offset(y: 0.5)
        }
        .foregroundStyle(look.text)
        .padding(.horizontal, 7)
        .frame(height: 17)
        .frame(maxWidth: 180)
        .background(RoundedRectangle(cornerRadius: 4, style: .circular).fill(look.fill))
        .borderRing(look.border, cornerRadius: 4)
        .fixedSize()
    }
}
