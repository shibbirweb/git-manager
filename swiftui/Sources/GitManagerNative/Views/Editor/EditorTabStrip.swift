// The editor's tab strip (src/lib/views/EditorTabs.svelte), measured in swiftui/Reference/diff-<mode>/editor-tabs.json
// and file-<mode>/editor-tabs.json: 34 points on --panel-alt with a bottom line; the diff tab first while a changed
// file is selected, then the file tabs. The active tab is on --editor-bg with a 2-point accent line on top; every tab
// has a right border, its icon at 80%, its name, a dim hint, and the close button, hidden on inactive tabs.

import NativeCore
import SwiftUI

struct EditorTabStrip: View {
    @Environment(\.theme) private var theme

    /// The diff tab's file name, when a changed file is selected.
    let diffName: String?
    let diffActive: Bool
    let tabs: EditorTabs
    var selectDiff: () -> Void = {}
    var closeDiff: () -> Void = {}
    var select: (String) -> Void = { _ in }
    var keep: (String) -> Void = { _ in }
    var close: (String) -> Void = { _ in }

    var body: some View {
        let labels = EditorTabs.labels(tabs.tabs)
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                if let diffName {
                    tab(icon: "git-compare", name: diffName, hint: "Diff", italic: false, active: diffActive,
                        select: selectDiff, close: closeDiff)
                }
                ForEach(tabs.tabs, id: \.path) { fileTab in
                    let label = labels[fileTab.path]
                    tab(icon: "file", name: label?.name ?? fileTab.path, hint: label?.hint, italic: fileTab.preview,
                        active: !diffActive && tabs.active == fileTab.path,
                        select: { select(fileTab.path) }, close: { close(fileTab.path) })
                        .simultaneousGesture(TapGesture(count: 2).onEnded { keep(fileTab.path) })
                }
            }
            .frame(height: 33)
            .frame(maxWidth: .infinity, alignment: .leading)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 34)
        .background(theme.color("--panel-alt"))
    }

    private func tab(
        icon: String, name: String, hint: String?, italic: Bool, active: Bool, select: @escaping () -> Void,
        close: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: 6) {
                Icon(name: icon, size: 13)
                    .opacity(0.8)
                if italic {
                    Text(name)
                        .font(Font(NSFontManager.shared.convert(PageFont.ui(13), toHaveTrait: .italicFontMask)))
                        .lineLimit(1)
                } else {
                    ExactText(text: name, size: 13)
                }
                if let hint {
                    // 11.5-point text with the normal line height: WebKit sets it half a point lower (measured).
                    ExactText(text: hint, size: 11.5)
                        .foregroundStyle(theme.ink("--text-faint"))
                        .offset(y: 0.5)
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, 6)
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture(perform: select)
            // .tab-close is --text-dim, unlike .icon-btn; hidden until the tab is active or hovered.
            Icon(name: "x", size: 12)
                .foregroundStyle(theme.ink("--text-dim"))
                .opacity(active ? 1 : 0)
                .frame(width: 20, height: 20)
                .contentShape(Rectangle())
                .onTapGesture(perform: close)
                .padding(.trailing, 4)
            theme.color("--border-strong").frame(width: 1)
        }
        .foregroundStyle(active ? theme.ink("--text") : theme.ink("--text-dim"))
        .frame(maxWidth: 240)
        .fixedSize(horizontal: true, vertical: false)
        .background(active ? theme.color("--editor-bg") : Color.clear)
        .overlay(alignment: .top) {
            if active {
                theme.color("--accent").frame(height: 2)
            }
        }
    }
}
