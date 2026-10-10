// Search Everywhere on its Text tab (Find in Files; src/lib/search/FileSearch.svelte, SearchTabs.svelte and
// ui/SearchToggles.svelte), measured in swiftui/Reference/search-<mode>/: 720 points wide, 12% of the window from
// the top, 10-point corners; the tab strip with the status at the right, the 40-point field with the Replace
// chevron, the search icon, the query and the Cc, W and .* toggles; then the results. Only the Text tab works in
// the native app so far: All, Classes, Files and Symbols are drawn but need the symbol index.

import NativeCore
import SwiftUI

struct SearchEverywhereView: View {
    @Environment(\.theme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var popups: SearchPopups

    let size: CGSize
    static let tabs = ["All", "Classes", "Files", "Symbols", "Text"]
    /// The popup's top is 12% of the window, 101.75 points here: WebKit paints its icons half a point above where
    /// SwiftUI snaps them on the 102 the box is drawn at (measured).
    static let iconLift: CGFloat = -0.5

    var body: some View {
        let rows = popups.text.rows
        let width = min(720, size.width - 32)
        let listMax = min(468, (size.height * 0.6 * 64).rounded(.down) / 64)
        let listHeight = rows.isEmpty ? 0 : min(listMax, 6 + CGFloat(rows.count) * PopupMetrics.rowHeight)
        let top = ((size.height * 0.12 * 64).rounded(.down) / 64 * 2).rounded() / 2
        let empty: CGFloat = rows.isEmpty ? 47 : 0
        let frame = CGRect(x: ((size.width - width) / 2).rounded(.down), y: top, width: width,
                           height: 1 + 31 + 40 + listHeight + empty + 1)
        let fullFrame = CGRect(x: frame.minX, y: top, width: width, height: 1 + 31 + 40 + listMax + 1)
        PopupFrame(frame: frame, cornerRadius: 10) {
            tabStrip
            field
            if rows.isEmpty {
                ExactText(text: TextSearchModel.emptyText(query: popups.value, results: popups.text,
                                                          running: popups.textRunning), size: 13)
                    .foregroundStyle(theme.ink("--text-faint"))
                    .frame(maxWidth: .infinity)
                    .frame(height: 47)
            }
            // Kept while there are no rows (0 points tall), so the first results only resize it: made new with
            // them, it was sometimes sized a pass later and the rows showed a frame late.
            TextResultsList(rows: rows, selected: popups.selected, height: listHeight,
                            textWidth: textWidth(popup: width, rows: rows.count, list: listHeight),
                            scrollTop: $popups.scrollTop, activate: popups.activate)
        }
        // Its heights: no results yet, whole rows, and the capped list (a fraction of the window).
        .onAppear {
            let emptyFrame = CGRect(x: frame.minX, y: top, width: width, height: 1 + 31 + 40 + 47 + 1)
            let rowsFrame = CGRect(x: frame.minX, y: top, width: width, height: 400)
            ShadowTiles.prewarm(boxes: [emptyFrame, fullFrame, rowsFrame], cornerRadius: 10,
                                dark: colorScheme == .dark)
        }
    }

    /// A line's text room: the popup less its borders, the list's padding (and scrollbar), the row's padding, the
    /// 38-point number column and the gap after it.
    private func textWidth(popup width: CGFloat, rows: Int, list height: CGFloat) -> CGFloat {
        let scrollbar: CGFloat = 6 + CGFloat(rows) * PopupMetrics.rowHeight > height + 0.5 ? 10 : 0
        return width - 2 - 8 - scrollbar - 16 - 38 - 8
    }

    private var tabStrip: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                HStack(spacing: 2) {
                    ForEach(Self.tabs, id: \.self) { tab in
                        tabButton(tab, active: tab == "Text")
                    }
                }
                Spacer(minLength: 0)
                ExactText(text: popups.textStatus, size: 11.5)
                    .foregroundStyle(theme.ink(popups.text.error == nil ? "--text-dim" : "--danger"))
                    .offset(y: 0.5)
            }
            .padding(.leading, 6)
            .padding(.trailing, 12)
            .padding(.top, 2)
            .frame(height: 30)
            theme.color("--border-strong").frame(height: 1)
        }
    }

    private func tabButton(_ label: String, active: Bool) -> some View {
        ExactText(text: label, size: 12.5, weight: active ? .semibold : .regular)
            .foregroundStyle(theme.ink(active ? "--text" : "--text-dim"))
            .offset(y: 0.5)
            .frame(height: 26)
            .padding(.horizontal, 9)
            .overlay(alignment: .bottom) {
                if active {
                    theme.color("--accent").frame(height: 2).offset(y: 2)
                }
            }
            .frame(height: 28, alignment: .top)
    }

    private var field: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Icon(name: "chevron-right", size: 14)
                    .offset(y: SearchEverywhereView.iconLift)
                    .frame(width: 22, height: 22)
                    .padding(.leading, -6)
                Icon(name: "search", size: 15)
                    .offset(y: SearchEverywhereView.iconLift)
                QueryField(
                    value: $popups.value,
                    placeholder: "Search file contents",
                    textColor: theme.textColor("--text"),
                    placeholderColor: theme.textColor("--text-faint"),
                    selectionColor: QueryField.selectionColor(theme: theme, dark: colorScheme == .dark),
                    selectAllRequests: popups.selectAllRequests,
                    onChange: popups.valueChanged,
                    onKey: popups.key
                )
                .frame(height: 39)
                // WebKit's input text starts a point further in than the field's.
                .offset(x: 1)
                HStack(spacing: 2) {
                    ForEach(["Cc", "W", ".*"], id: \.self) { label in
                        ExactText(text: label, size: 11.5, face: CodeFont.font(11.5))
                            .foregroundStyle(theme.ink("--text-dim"))
                            .frame(minWidth: 26, minHeight: 24)
                    }
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, 8)
            .frame(height: 39)
            .foregroundStyle(theme.ink("--text-dim"))
            theme.color("--border-strong").frame(height: 1)
        }
    }
}
