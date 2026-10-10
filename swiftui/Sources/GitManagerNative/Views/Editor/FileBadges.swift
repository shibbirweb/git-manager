// The file bar's badges after the path (FileView.svelte .badge): Unsaved while the text differs from the file, then
// the file's git state (Modified, New file or Conflicted). 16 points tall with 8-point corners, 6 points of padding,
// 11-point text in the badge's color on that color at 15% (18% for Unsaved) over --panel.

import SwiftUI

struct FileBadges: View {
    @Environment(\.theme) private var theme

    let tone: FileTone?
    let dirty: Bool

    var body: some View {
        HStack(spacing: 6) {
            if dirty {
                badge("Unsaved", color: "--warning", share: 0.18)
            }
            if let (label, color) = toneBadge {
                badge(label, color: color, share: 0.15)
            }
        }
    }

    /// toneLabel: a deleted file has none.
    private var toneBadge: (String, String)? {
        switch tone {
        case .conflict:
            return ("Conflicted", "--danger")
        case .added:
            return ("New file", "--success")
        case .modified:
            return ("Modified", "--accent")
        case .deleted, nil:
            return nil
        }
    }

    private func badge(_ label: String, color: String, share: Double) -> some View {
        ExactText(text: label, size: 11)
            .foregroundStyle(theme.ink(color))
            .padding(.horizontal, 6)
            .frame(height: 16)
            .background(RoundedRectangle(cornerRadius: 8, style: .circular)
                .fill(theme.fill(color, share, on: "--panel")))
            .fixedSize()
    }
}
