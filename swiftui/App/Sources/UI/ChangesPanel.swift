// The Changes sidebar (src/lib/views/ChangesView.svelte): the heading row, the grouped file list and the commit box,
// measured in swiftui/Reference/changes-<mode>/changes-head.json, group-headers.json and file-rows.json.

import SwiftUI

struct ChangesPanel: View {
    @Environment(\.theme) private var theme

    let status: RepoStatus?
    let errorText: String?

    var body: some View {
        let groups = FileGroups(status?.files ?? [])
        VStack(spacing: 0) {
            ChangesHead(count: status?.files.count ?? 0, head: status?.head, decorations: groups.decorations)
            if let errorText {
                Text(errorText)
                    .foregroundStyle(theme.color("--danger"))
                    .padding(12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        group("Staged", groups.staged, kind: \.staged)
                        group("Changes", groups.unstaged, kind: \.unstaged)
                    }
                    .padding(.top, 4)
                }
                .scrollIndicators(.never)
            }
            CommitBox(stagedCount: groups.staged.count, ahead: status?.head.ahead ?? 0)
        }
    }

    /// A group with its header and rows, then 4 points before the next one; nothing when it is empty.
    @ViewBuilder
    private func group(_ title: String, _ files: [FileStatus], kind: KeyPath<FileStatus, String?>) -> some View {
        if !files.isEmpty {
            GroupHeader(title: title, count: files.count)
            ForEach(files, id: \.path) { file in
                FileRow(file: file, kind: file[keyPath: kind])
            }
            Color.clear.frame(height: 4)
        }
    }
}

/// "CHANGES 4", the repository's actions (branch with its markers, sync, commit, refresh, more) and close; 34 points
/// tall with a bottom line.
struct ChangesHead: View {
    @Environment(\.theme) private var theme

    let count: Int
    let head: HeadInfo?
    let decorations: String

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text("CHANGES")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.66)
                    .foregroundStyle(theme.color("--text-dim"))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .layoutPriority(-1)
                Text("\(count)")
                    .font(.system(size: 11))
                    .padding(.horizontal, 5)
                    .frame(minWidth: 18, minHeight: 16)
                    .background(Capsule().fill(theme.color("--hover")))
                // The current app leaves 12 points before the actions: the gap on each side of this spacer.
                Spacer(minLength: 0)
                actions
                IconButton(width: 24, height: 24, action: {}) {
                    Icon(name: "x", size: 14)
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, 6)
            .frame(maxHeight: .infinity)
            theme.color("--border-strong").frame(height: 1)
        }
        .frame(height: 34)
    }

    /// The repository's row actions in --text-dim: 20 points tall, 4-point corners, 1 apart.
    private var actions: some View {
        HStack(spacing: 1) {
            HStack(spacing: 2) {
                Icon(name: "branch", size: 12)
                Text(decorations)
                    .font(.system(size: 12, weight: .semibold))
            }
            .padding(.horizontal, 4)
            .frame(height: 20)
            if let head, head.ahead > 0 || head.behind > 0 {
                HStack(spacing: 2) {
                    Icon(name: "sync", size: 13)
                    Text(head.ahead > 0 ? "\(head.ahead)↑" : "\(head.behind)↓")
                        .font(.system(size: 11))
                }
                .padding(.horizontal, 3)
                .frame(height: 20)
            }
            action("check", size: 14)
            action("refresh", size: 13)
            action("more", size: 14)
        }
        .foregroundStyle(theme.color("--text-dim"))
    }

    private func action(_ icon: String, size: CGFloat) -> some View {
        Icon(name: icon, size: size)
            .frame(width: 20, height: 20)
    }
}
