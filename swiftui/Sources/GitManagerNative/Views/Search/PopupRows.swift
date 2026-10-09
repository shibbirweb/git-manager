// Rows shared by Quick Open and Search Everywhere (.row, .section and .message in QuickOpen.svelte and
// FileSearch.svelte), measured in swiftui/Reference/<screen>-<mode>/popup.json: 26 points tall, 8 points of padding
// and gap, 4-point corners, --selected under the selected row; matched letters semibold in --accent.

import NativeCore
import SwiftUI

enum PopupMetrics {
    static let rowHeight: CGFloat = 26
}

/// Text in runs, the matched ones semibold in --accent (<b> in the page).
struct PartsText: View {
    @Environment(\.theme) private var theme

    let parts: [TextPart]
    var size: CGFloat = 13
    var color = "--text"

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                ExactText(text: part.text, size: size, weight: part.match ? .semibold : .regular)
                    .foregroundStyle(theme.ink(part.match ? "--accent" : color))
            }
        }
        .fixedSize()
    }
}

/// A popup row's frame: the padding, the height, the selection and the pointer.
struct PopupRowFrame<Content: View>: View {
    @Environment(\.theme) private var theme

    var selected = false
    var gap: CGFloat = 8
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(spacing: gap) {
            content()
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: PopupMetrics.rowHeight)
        .background(RoundedRectangle(cornerRadius: 4, style: .circular)
            .fill(selected ? theme.systemColor("--selected") : Color.clear))
        .foregroundStyle(theme.ink("--text-dim"))
        .contentShape(Rectangle())
    }
}

/// "RECENTLY OPENED": 11 points, semibold, uppercase, 0.04em apart, --text-faint, at the right (Quick Open) or the
/// left (Search Everywhere).
struct PopupSectionRow: View {
    @Environment(\.theme) private var theme

    let label: String
    var trailing = true

    var body: some View {
        PopupRowFrame {
            if trailing {
                Spacer(minLength: 0)
            }
            ExactText(text: label.uppercased(), size: 11, weight: .semibold, tracking: 0.44)
                .foregroundStyle(theme.ink("--text-faint"))
                .offset(y: 0.5)
            if !trailing {
                Spacer(minLength: 0)
            }
        }
    }
}

/// A message instead of results ("No files match").
struct PopupMessageRow: View {
    @Environment(\.theme) private var theme

    let label: String

    var body: some View {
        PopupRowFrame {
            ExactText(text: label, size: 13)
                .foregroundStyle(theme.ink("--text-faint"))
        }
    }
}

/// A file: its icon, the name (at most 70% of the row in Quick Open, 60% in Search Everywhere) and the folder at
/// the right in 12 points.
struct PopupFileRow: View {
    @Environment(\.theme) private var theme

    let file: SearchRow
    let selected: Bool

    var body: some View {
        PopupRowFrame(selected: selected) {
            Icon(name: "file", size: 14)
            PartsText(parts: file.nameParts)
            Spacer(minLength: 0)
            if !file.folderParts.isEmpty {
                PartsText(parts: file.folderParts, size: 12, color: "--text-faint")
            }
        }
    }
}
