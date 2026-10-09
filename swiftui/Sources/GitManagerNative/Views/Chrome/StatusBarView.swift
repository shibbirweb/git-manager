// The status bar (src/lib/views/StatusBar.svelte as in the installed release, 0.1.0-beta.7), measured in
// swiftui/Reference/<screen>-<mode>/status-bar.json: 12-point text in --text-dim, items 20 points tall with 7
// points of padding and 5 between icon and text, 2 apart, 6 from the window edges.

import NativeCore
import SwiftUI

struct StatusBarView: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var readout = MemoryReadout.shared
    // The file items follow the editor and the diff here, not in ContentView, so a cursor move or an opened diff
    // renders the status bar, not the whole window.
    @EnvironmentObject private var editor: EditorModel
    @EnvironmentObject private var diffs: DiffStore

    let folderName: String
    let head: HeadInfo?
    let changeCount: Int
    /// The write running now ("Stage"), shown before the bell.
    var busy: String?
    /// Unread errors and warnings on the bell's badge, red when one is an error.
    var unread = 0
    var unreadError = false
    var openBell: () -> Void = {}

    /// The shown file's cursor, indentation, line ends and language ("Ln 1, Col 1", "Spaces: 2", "LF",
    /// "TypeScript"), before the bell.
    private var fileItems: [String] {
        guard let file = editor.file, !editor.diffActive || diffs.openDiff == nil else {
            return []
        }
        // FileView.svelte: the main selection's head, its line, and its UTF-16 offset in that line.
        let head = editor.session?.state.selection.main.head ?? 0
        let line = editor.session?.state.doc.lineAt(head)
        let position = "Ln \((line?.index ?? 0) + 1), Col \(head - (line?.from ?? 0) + 1)"
        return [position, EditorInfo.indentLabel(file.indent), file.eolLabel, file.language]
    }

    var body: some View {
        HStack(spacing: 2) {
            item(icon: "folder-git", text: folderName)
            if let head {
                item(icon: "branch", text: head.branch ?? head.shortId ?? "")
                // Synchronize Changes (changes/sync.ts rowSync): Publish Branch without an upstream, else the counts.
                if !head.unborn, head.branch != nil {
                    if head.upstream == nil {
                        item(icon: "cloud-upload", text: "")
                    } else {
                        item(icon: "sync", text: syncText(head))
                    }
                }
            }
            if changeCount > 0 {
                item(icon: "git-compare", text: changeCount == 1 ? "1 change" : "\(changeCount) changes")
            }
            StatusBarConflicts()
            Spacer(minLength: 0)
            if let busy {
                BusyLabel(label: busy, spinnerSize: 10, gap: 5)
                    .padding(.horizontal, 7)
                    .frame(height: 20)
            }
            ForEach(Array(fileItems.enumerated()), id: \.offset) { _, text in
                ExactText(text: text)
                    .padding(.horizontal, 7)
                    .frame(height: 20)
            }
            if !fileItems.isEmpty {
                // .gap: 6 points after the file's items.
                Color.clear.frame(width: 6, height: 1)
            }
            bell
            iconOnly("star")
            iconOnly("bug")
            if let memoryBytes = readout.bytes, memoryBytes > 0 {
                memory(memoryBytes)
            }
            iconOnly("brush")
        }
        .padding(.horizontal, 6)
        .font(.system(size: 12))
        .foregroundStyle(theme.ink("--text-dim"))
        // Anchored to the window's bottom: the page lays the bar out a quarter point higher (SVGBiasKey).
        .svgBias(-0.25)
    }

    /// rowSyncBadge: pulls, then pushes ("2↓ 1↑"); empty when even.
    private func syncText(_ head: HeadInfo) -> String {
        var parts: [String] = []
        if head.behind > 0 {
            parts.append("\(head.behind)↓")
        }
        if head.ahead > 0 {
            parts.append("\(head.ahead)↑")
        }
        return parts.joined(separator: " ")
    }

    private func item(icon: String, text: String) -> some View {
        HStack(spacing: 5) {
            Icon(name: icon, size: 12)
            if !text.isEmpty {
                ExactText(text: text)
            }
        }
        .padding(.horizontal, 7)
        .frame(height: 20)
    }

    /// The bell (NotificationBell.svelte): 22 x 20 alone; with unread alerts, its badge 3 points after the icon, in
    /// --danger for an error or --warning, 14 points tall with 10-point semibold digits.
    @ViewBuilder
    private var bell: some View {
        if unread > 0 {
            Button(action: openBell) {
                HStack(spacing: 3) {
                    Icon(name: "bell", size: 12)
                    Text(Notices.badgeText(unread))
                        .font(PageFont.font(10, weight: .semibold))
                        .foregroundStyle(theme.ink("--accent-text"))
                        .padding(.horizontal, 4)
                        .frame(minWidth: 14, minHeight: 14)
                        .background(Capsule(style: .circular).fill(theme.color(unreadError ? "--danger" : "--warning")))
                }
                .padding(.horizontal, 5)
                .frame(height: 20)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } else {
            iconOnly("bell")
        }
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
