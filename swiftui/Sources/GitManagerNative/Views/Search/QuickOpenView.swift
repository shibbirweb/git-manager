// Quick Open and the Command Palette (src/lib/quickOpen/QuickOpen.svelte), measured in
// swiftui/Reference/quickopen-<mode>/ and palette-<mode>/: 620 points wide (at most the window less 32), 8 points
// from the top, 8-point corners; the 38-point field with the search icon (the carets for commands), the 14-point
// query and the mode's name in 11.5 points at the right; then the list, at most 468 points (60% of the window).

import NativeCore
import SwiftUI

struct QuickOpenView: View {
    @Environment(\.theme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var popups: SearchPopups
    @ObservedObject private var recent = RecentFiles.shared

    let size: CGSize

    var body: some View {
        let rows = popups.quickRows
        let width = min(620, size.width - 32)
        let listMax = min(468, (size.height * 0.6 * 64).rounded(.down) / 64)
        let listHeight = min(listMax, 8 + CGFloat(max(1, rows.count)) * PopupMetrics.rowHeight)
        let frame = CGRect(x: ((size.width - width) / 2).rounded(.down), y: 8, width: width,
                           height: 1 + 38 + listHeight + 1)
        PopupFrame(frame: frame, cornerRadius: 8) {
            field
            PopupList(count: rows.count, height: listHeight, scrollTop: $popups.scrollTop) { index in
                row(rows[index], index: index)
            }
        }
    }

    private var field: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Icon(name: popups.parsed.mode == .commands ? "carets" : "search", size: 15)
                QueryField(
                    value: $popups.value,
                    placeholder: "Search files by name, or type ? for help",
                    textColor: theme.textColor("--text"),
                    placeholderColor: theme.textColor("--text-faint"),
                    selectionColor: QueryField.selectionColor(theme: theme, dark: colorScheme == .dark),
                    selectAllRequests: 0,
                    onChange: popups.valueChanged,
                    onKey: key
                )
                .frame(height: 37)
                // WebKit's input text starts a point further in than the field's.
                .offset(x: 1)
                ExactText(text: popups.quickStatus, size: 11.5)
                    .foregroundStyle(theme.ink("--text-faint"))
                    .offset(y: 0.5)
            }
            .padding(.horizontal, 12)
            .frame(height: 37)
            .foregroundStyle(theme.ink("--text-dim"))
            theme.color("--border-strong").frame(height: 1)
        }
    }

    @ViewBuilder
    private func row(_ row: QuickRow, index: Int) -> some View {
        let selected = index == popups.selected
        switch row {
        case .header(_, let label):
            PopupSectionRow(label: label)
        case .message(_, let label):
            PopupMessageRow(label: label)
        case .line(_, let label, _):
            PopupMessageRow(label: label)
        case .file(_, let file):
            PopupFileRow(file: file, selected: selected)
                .onTapGesture { popups.activate(index) }
        case .command(_, let command):
            CommandRow(command: command, selected: selected)
                .onTapGesture { popups.activate(index) }
        case .help(_, let prefix, let label):
            PopupRowFrame(selected: selected) {
                KeyCaps(text: prefix.isEmpty ? "..." : prefix)
                ExactText(text: label, size: 13)
                    .foregroundStyle(theme.ink("--text"))
            }
            .onTapGesture { popups.activate(index) }
        }
    }

    private func key(_ key: QueryField.Key) {
        popups.key(key)
    }
}
