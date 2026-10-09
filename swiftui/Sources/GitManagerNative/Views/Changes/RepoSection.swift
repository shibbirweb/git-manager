// One repository's part of Changes when the workspace holds several (src/lib/views/changes/RepoSection.svelte):
// its header (chevron, name, change count, operation badge and the row actions), then its groups 12 points in.

import NativeCore
import SwiftUI

struct RepoSection<Groups: View>: View {
    @Environment(\.theme) private var theme
    @State private var hovered = false

    let repo: WorkspaceRepo
    let status: RepoStatus
    let active: Bool
    let collapsed: Bool
    var busy = false
    var toggle: () -> Void = {}
    var commit: () -> Void = {}
    var refresh: () -> Void = {}
    @ViewBuilder let groups: () -> Groups

    var body: some View {
        VStack(spacing: 0) {
            header
            if !collapsed {
                groups()
            }
        }
    }

    private var header: some View {
        let files = FileGroups(status.files)
        let op = WorkspaceRules.opLabel(status.op?.kind)
        return RepoHeaderLayout(toggleMinWidth: Self.toggleMinWidth(repo.name, count: status.files.count, op: op)) {
            Button(action: toggle) {
                toggleLabel(op: op)
            }
            .buttonStyle(.plain)
            RepoActions(
                head: status.head, decorations: files.decorations, busy: busy,
                commitBlocked: !files.conflicts.isEmpty || files.staged.isEmpty,
                publish: ChangesPanel.publishes(status),
                operation: status.op.map { $0.kind != "none" } ?? false,
                commit: commit, refresh: refresh
            )
        }
        .padding(.leading, 4)
        .padding(.trailing, 6)
        .background(hovered ? theme.color("--hover") : .clear)
        // .repo-header.active::before: a 3-point accent bar, 5 points from the top and bottom, rounded on the right.
        .overlay(alignment: .leading) {
            if active {
                HalfRoundedRectangle(roundedSide: .trailing, radius: 2)
                    .fill(theme.color("--accent"))
                    .frame(width: 3)
                    .padding(.vertical, 5)
            }
        }
        .contentShape(Rectangle())
        .onHover { hovered = $0 }
    }

    /// .repo-toggle: 28 points tall, 4 points of padding, 6 between the chevron, the name and the badges.
    private func toggleLabel(op: String?) -> some View {
        HStack(spacing: 6) {
            Icon(name: collapsed ? "chevron-right" : "chevron-down", size: 13)
            // At its exact width while it fits, so the badges after it land where WebKit puts them.
            ViewThatFits(in: .horizontal) {
                ExactText(text: repo.name, size: 13, weight: .semibold)
                Text(repo.name)
                    .font(PageFont.font(13, weight: .semibold))
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            CountBadge(count: status.files.count)
            if let op {
                // .op-badge: 11-point semibold --warning on its 18% tint, 8-point corners, 16 points tall.
                ExactText(text: op, size: 11, weight: .semibold)
                    .foregroundStyle(theme.ink("--warning"))
                    .padding(.horizontal, 6)
                    .frame(height: 16)
                    .background(Capsule(style: .circular).fill(theme.fill("--warning", 0.18, on: "--panel")))
                    .fixedSize()
            }
        }
        .padding(.horizontal, 4)
        .frame(height: 28)
        .foregroundStyle(theme.ink("--text"))
        .contentShape(Rectangle())
    }

    /// The toggle's narrowest width (its min-content): a few letters of the name (--name-min: up to 4ch) and the
    /// badges whole. Below it plus the actions, the actions wrap to a second line.
    static func toggleMinWidth(_ name: String, count: Int, op: String?) -> CGFloat {
        let digit = ExactText.width("0", font: PageFont.ui(13))
        var width = 4 + 13 + 6 + CGFloat(min(name.count, 4)) * digit + 6 + CountBadge.width(count) + 4
        if let op {
            width += 6 + ExactText.width(op, font: PageFont.ui(11, weight: .semibold)) + 12
        }
        return width
    }
}

/// .badge: the change count in 11-point semibold --text-dim on --selected-inactive, at least 18 wide, 17 tall.
struct CountBadge: View {
    @Environment(\.theme) private var theme
    let count: Int

    var body: some View {
        // 11-point text in a 17-point line: WebKit sets it half a point lower than SwiftUI (measured).
        ExactText(text: "\(count)", size: 11, weight: .semibold)
            .foregroundStyle(theme.ink("--text-dim"))
            .offset(y: 0.5)
            .padding(.horizontal, 5)
            .frame(minWidth: 18)
            .frame(height: 17)
            .background(Capsule(style: .circular).fill(theme.color("--selected-inactive")))
            .fixedSize()
    }

    static func width(_ count: Int) -> CGFloat {
        max(18, ExactText.width("\(count)", font: PageFont.ui(11, weight: .semibold)) + 10)
    }
}

/// The header's flex-wrap row: the toggle and the actions on one 28-point line when their narrowest widths fit
/// (4 points apart, the actions at the right end, the name truncating), else the actions on a second line of
/// 24 points at the right.
struct RepoHeaderLayout: Layout {
    let toggleMinWidth: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        return CGSize(width: width, height: fitsOneLine(width, subviews) ? 28 : 52)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 2 else {
            return
        }
        let actions = subviews[1].sizeThatFits(.unspecified)
        let toggleIdeal = subviews[0].sizeThatFits(.unspecified).width
        if fitsOneLine(bounds.width, subviews) {
            let toggleWidth = min(toggleIdeal, bounds.width - 4 - actions.width)
            subviews[0].place(at: CGPoint(x: bounds.minX, y: bounds.minY),
                              proposal: .init(width: toggleWidth, height: 28))
            subviews[1].place(at: CGPoint(x: bounds.maxX - actions.width, y: bounds.midY), anchor: .leading,
                              proposal: .unspecified)
            return
        }
        subviews[0].place(at: CGPoint(x: bounds.minX, y: bounds.minY),
                          proposal: .init(width: min(toggleIdeal, bounds.width), height: 28))
        subviews[1].place(at: CGPoint(x: bounds.maxX - actions.width, y: bounds.minY + 28 + 12), anchor: .leading,
                          proposal: .unspecified)
    }

    private func fitsOneLine(_ width: CGFloat, _ subviews: Subviews) -> Bool {
        let actions = subviews.count == 2 ? subviews[1].sizeThatFits(.unspecified).width : 0
        return toggleMinWidth + 4 + actions <= width
    }
}
