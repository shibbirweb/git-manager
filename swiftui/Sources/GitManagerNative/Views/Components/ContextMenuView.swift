// The context menu (ContextMenuHost.svelte): each open level is a .menu box (PopupFrame: --panel, a 1-point
// --border-strong ring, 8-point corners and var(--shadow)) at least 200 wide, with 4 points of padding. A row is 5 by
// 10 points of padding around a 16-point line: the label, then 24 points on, its hint in --text-faint or a
// submenu's chevron. The highlighted row is --accent with --accent-text; separators are 1 point with 4 by 6 around.

import NativeCore
import SwiftUI

enum MenuMetrics {
    static let rowHeight: CGFloat = 26
    static let separatorHeight: CGFloat = 9
    static let minWidth: CGFloat = 200
    /// Padding and border on each side of the box.
    static let inset: CGFloat = 5

    /// The box of one menu level: its widest row (label, gap, hint or chevron) or 200, and its rows' heights.
    static func size(_ items: [MenuItem]) -> CGSize {
        let font = PageFont.ui(13)
        var widest: CGFloat = 0
        var height = inset * 2
        for item in items {
            if item.isSeparator {
                height += separatorHeight
                continue
            }
            height += rowHeight
            var width = ExactText.width(MenuNav.shownLabel(item.label), font: font)
            if item.submenuItems != nil {
                width += 24 + 9
            } else if let hint = item.hint, !hint.isEmpty {
                width += 24 + ExactText.width(MenuNav.shownLabel(hint), font: font)
            }
            widest = max(widest, width + 20)
        }
        return CGSize(width: max(minWidth, widest + inset * 2), height: height)
    }

    /// A row's top in its menu box.
    static func rowTop(_ items: [MenuItem], index: Int) -> CGFloat {
        items.prefix(index).reduce(inset) { $0 + ($1.isSeparator ? separatorHeight : rowHeight) }
    }
}

struct ContextMenuOverlay: View {
    @EnvironmentObject private var center: ContextMenuCenter

    var body: some View {
        if center.visible {
            GeometryReader { proxy in
                let frames = frames(viewport: proxy.size)
                ZStack(alignment: .topLeading) {
                    ForEach(Array(frames.enumerated()), id: \.offset) { level, frame in
                        PopupFrame(frame: frame, cornerRadius: 8, pageLayer: true) {
                            MenuLevel(level: level, items: center.levels[level])
                        }
                    }
                }
                .onAppear { center.boxes = frames }
                .onChange(of: frames) { center.boxes = $0 }
            }
        }
    }

    /// Each open level's box: the root kept inside the window, each submenu beside its row.
    private func frames(viewport: CGSize) -> [CGRect] {
        var result: [CGRect] = []
        for (level, items) in center.levels.enumerated() {
            let size = MenuMetrics.size(items)
            if level == 0 {
                let origin = MenuNav.rootPosition(x: center.origin.x, y: center.origin.y, menu: size,
                                                  viewport: viewport, alignEnd: center.alignEnd)
                result.append(CGRect(origin: origin, size: size))
                continue
            }
            let parent = result[level - 1]
            let parentItems = center.levels[level - 1]
            let top = parent.minY + MenuMetrics.rowTop(parentItems, index: center.highlighted(level - 1))
            let row = CGRect(x: parent.minX, y: top, width: parent.width, height: MenuMetrics.rowHeight)
            let origin = MenuNav.submenuPosition(row: row, menu: size, viewport: viewport)
            result.append(CGRect(origin: origin, size: size))
        }
        return result
    }
}

private struct MenuLevel: View {
    @Environment(\.theme) private var theme
    @EnvironmentObject private var center: ContextMenuCenter

    let level: Int
    let items: [MenuItem]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                if item.isSeparator {
                    theme.color("--border-strong")
                        .frame(height: 1)
                        .padding(.vertical, 4)
                        .padding(.horizontal, 6)
                } else {
                    MenuRow(item: item, highlighted: center.highlighted(level) == index)
                        .pageHover { inside in
                            if inside {
                                center.hover(level: level, index: index)
                            }
                        }
                        .onTapGesture {
                            center.activate(level: level, index: index, fromKeyboard: false)
                        }
                        // A menu item to Accessibility, as the page's role="menuitem" buttons are.
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(MenuNav.shownLabel(item.label))
                        .accessibilityAddTraits(.isButton)
                        .accessibilityAction {
                            center.activate(level: level, index: index, fromKeyboard: false)
                        }
                }
            }
        }
        .padding(4)
    }
}

private struct MenuRow: View {
    @Environment(\.theme) private var theme

    let item: MenuItem
    let highlighted: Bool

    var body: some View {
        let lit = highlighted && !item.disabled
        // The 24-point gap only between the label and a hint or chevron (an HStack would space the Spacer too).
        HStack(spacing: 0) {
            ExactText(text: MenuNav.shownLabel(item.label), size: 13)
            Spacer(minLength: item.submenuItems != nil || !(item.hint ?? "").isEmpty ? 24 : 0)
            if item.submenuItems != nil {
                Icon(name: "chevron-right", size: 13)
                    .opacity(0.8)
                    .padding(.trailing, -4)
            } else if let hint = item.hint, !hint.isEmpty {
                ExactText(text: MenuNav.shownLabel(hint), size: 13)
                    .foregroundStyle(lit ? theme.ink("--accent-text") : theme.ink("--text-faint"))
                    .opacity(lit ? 0.8 : 1)
            }
        }
        .padding(.horizontal, 10)
        .frame(height: MenuMetrics.rowHeight)
        .foregroundStyle(theme.ink(lit ? "--accent-text" : item.danger ? "--danger" : "--text"))
        .background(RoundedRectangle(cornerRadius: 4, style: .circular)
            .fill(lit ? theme.color(item.danger ? "--danger" : "--accent") : Color.clear))
        .opacity(item.disabled ? 0.45 : 1)
        .contentShape(Rectangle())
    }
}
