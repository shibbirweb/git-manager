// The commit box's target row with several repositories (CommitBox.svelte .target): "Commit to", the repository
// picker (a select with each repository that has changes) or the name alone, and "on <branch>".

import NativeCore
import SwiftUI

struct CommitTarget {
    /// The picker's shown entry, such as "payments-api, 4 staged".
    let label: String
    let name: String
    let branch: String?
    /// More than one repository to pick from: a select, else the name in semibold.
    let picker: Bool
}

struct CommitTargetRow: View {
    @Environment(\.theme) private var theme
    let target: CommitTarget

    /// WebKit's select (measured): the text 9 points in, half a point higher than SwiftUI sets it, and clipped
    /// 21 points before the right edge, where the arrows sit 10.75 points in.
    static let textInset: CGFloat = 9
    static let arrowRoom: CGFloat = 21
    /// What the select adds after its text in its natural width (padding, border and the arrows' area).
    static let naturalRight: CGFloat = 23.5
    /// The select's corners come out tighter than its 6px border-radius (measured from the curve).
    static let cornerRadius: CGFloat = 5

    var body: some View {
        GeometryReader { proxy in
            let widths = Self.widths(target, rowWidth: proxy.size.width)
            // Each part at its own offset: an HStack left the select a quarter point off the pixel WebKit snaps to.
            ZStack(alignment: .leading) {
                ExactText(text: "Commit to", size: 12)
                    .foregroundStyle(theme.ink("--text-dim"))
                    .fixedSize()
                Group {
                    if target.picker {
                        picker(width: widths.middle)
                    } else {
                        ExactText(
                            text: ExactText.cut(target.name, width: widths.middle,
                                                font: PageFont.ui(13, weight: .semibold)),
                            size: 13, weight: .semibold
                        )
                        .fixedSize()
                    }
                }
                .padding(.leading, widths.label + 6)
                if let branch = target.branch {
                    let cut = ExactText.cut("on \(branch)", width: widths.branch, font: PageFont.ui(12))
                    ExactText(text: cut, size: 12)
                        .foregroundStyle(theme.ink("--text-dim"))
                        .fixedSize()
                        .padding(.leading, widths.label + 6 + widths.middle + 6)
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .leading)
        }
        .frame(height: 24)
    }

    /// The select on --panel with a --border-strong line and 6-point corners; the entry is clipped, not ellipsized.
    private func picker(width: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: Self.cornerRadius, style: .circular)
            .fill(theme.color("--panel"))
            .borderRing(theme.color("--border-strong"), cornerRadius: Self.cornerRadius)
            .frame(width: width, height: 24)
            // In overlays, so the clipped entry never widens the row.
            .overlay(alignment: .leading) {
                Color.clear
                    .frame(width: max(0, width - Self.arrowRoom), height: 24)
                    .overlay(alignment: .leading) {
                        Text(target.label)
                            .font(PageFont.font(13, weight: .semibold))
                            .lineLimit(1)
                            .fixedSize()
                            .padding(.leading, Self.textInset)
                            .offset(y: -0.5)
                    }
                    .clipped()
            }
            .overlay(alignment: .trailing) {
                SelectArrows()
                    .stroke(theme.ink("--text"), style: StrokeStyle(lineWidth: 1.2, lineCap: .round, lineJoin: .round))
                    .frame(width: 6.5, height: 8.5)
                    .offset(y: -0.25)
                    .padding(.trailing, 10.75 - 3.25)
            }
    }

    /// The flex row: "Commit to" keeps its width; the select (or the name alone) and the branch start at their
    /// natural widths (the flex base sizes, the select's unclamped) and, when they overflow, give way in proportion
    /// to them; the select is then held to 70% of the row. Edges land on device pixels, as WebKit snaps them.
    static func widths(
        _ target: CommitTarget, rowWidth: CGFloat
    ) -> (label: CGFloat, middle: CGFloat, branch: CGFloat) {
        let label = snap(ExactText.width("Commit to", font: PageFont.ui(12)))
        let text = ExactText.width(target.picker ? target.label : target.name, font: PageFont.ui(13, weight: .semibold))
        let middle = target.picker ? textInset + text + naturalRight : text
        let branch = target.branch.map { ExactText.width("on \($0)", font: PageFont.ui(12)) } ?? 0
        let gaps: CGFloat = target.branch == nil ? 6 : 12
        let shrunk = FlexShrink.widths(
            bases: [middle, branch], maxes: [target.picker ? rowWidth * 0.7 : nil, nil], fixed: label + gaps,
            available: rowWidth
        )
        return (label, target.picker ? snap(shrunk[0]) : shrunk[0], shrunk[1])
    }

    private static func snap(_ width: CGFloat) -> CGFloat {
        (width * 2).rounded() / 2
    }
}

/// WebKit's select arrows: a chevron up over a chevron down, each 6.5 x 3 points, 2.5 points apart.
private struct SelectArrows: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + 3))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + 3))
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY - 3))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - 3))
        return path
    }
}
