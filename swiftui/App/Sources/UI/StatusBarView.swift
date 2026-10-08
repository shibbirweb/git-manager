// The status bar (src/lib/views/StatusBar.svelte as in the installed release, 0.1.0-beta.7), measured in
// swiftui/Reference/<screen>-<mode>/status-bar.json: 12-point text in --text-dim, items 20 points tall with 7
// points of padding and 5 between icon and text, 2 apart, 6 from the window edges.

import NativeCore
import SwiftUI

struct StatusBarView: View {
    @Environment(\.theme) private var theme

    let folderName: String
    let head: HeadInfo?
    let changeCount: Int
    let memoryBytes: UInt64?

    var body: some View {
        HStack(spacing: 2) {
            item(icon: "folder-git", text: folderName)
            if let head {
                item(icon: "branch", text: head.branch ?? head.shortId ?? "")
                if head.ahead > 0 || head.behind > 0 {
                    item(icon: "sync", text: syncText(head))
                }
            }
            item(icon: "git-compare", text: changeCount == 1 ? "1 change" : "\(changeCount) changes")
            Spacer(minLength: 0)
            iconOnly("bell")
            iconOnly("star")
            iconOnly("bug")
            if let memoryBytes, memoryBytes > 0 {
                memory(memoryBytes)
            }
            iconOnly("brush")
        }
        .padding(.horizontal, 6)
        .font(.system(size: 12))
        .foregroundStyle(theme.color("--text-dim"))
    }

    private func syncText(_ head: HeadInfo) -> String {
        var parts: [String] = []
        if head.ahead > 0 {
            parts.append("\(head.ahead)↑")
        }
        if head.behind > 0 {
            parts.append("\(head.behind)↓")
        }
        return parts.joined(separator: " ")
    }

    private func item(icon: String, text: String) -> some View {
        HStack(spacing: 5) {
            Icon(name: icon, size: 12)
            Text(text)
                .lineLimit(1)
        }
        .padding(.horizontal, 7)
        .frame(height: 20)
    }

    /// .item.icon-only: 22 x 20 with the 12-point icon in the middle.
    private func iconOnly(_ icon: String) -> some View {
        Icon(name: icon, size: 12)
            .frame(width: 22, height: 20)
    }

    /// The memory readout: the 13-point memory icon, then the size as formatBytes writes it.
    private func memory(_ bytes: UInt64) -> some View {
        HStack(spacing: 5) {
            Icon(name: "memory", size: 13)
            Text(ByteText.status(bytes))
        }
        .padding(.horizontal, 7)
        .frame(height: 20)
    }
}
