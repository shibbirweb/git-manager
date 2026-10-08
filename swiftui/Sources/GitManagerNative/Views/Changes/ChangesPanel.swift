// The Changes sidebar (src/lib/views/ChangesView.svelte): the heading row, the grouped file list and the commit box,
// measured in swiftui/Reference/changes-<mode>/changes-head.json, group-headers.json and file-rows.json.

import SwiftUI

struct ChangesPanel: View {
    @Environment(\.theme) private var theme

    let status: RepoStatus?
    let errorText: String?
    /// The row whose diff is open: its path and whether it is the staged change.
    var selected: (path: String, staged: Bool)?
    /// A click on a row: the file and whether it is the staged change.
    var select: (FileStatus, Bool) -> Void = { _, _ in }

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
                        group("Staged", groups.staged, kind: \.staged, staged: true)
                        group("Changes", groups.unstaged, kind: \.unstaged, staged: false)
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
    private func group(
        _ title: String, _ files: [FileStatus], kind: KeyPath<FileStatus, String?>, staged: Bool
    ) -> some View {
        if !files.isEmpty {
            GroupHeader(title: title, count: files.count)
            ForEach(files, id: \.path) { file in
                FileRow(file: file, kind: file[keyPath: kind])
                    .background(isSelected(file, staged) ? theme.color("--selected-inactive") : .clear)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        select(file, staged)
                    }
            }
            Color.clear.frame(height: 4)
        }
    }

    /// The list never has focus while the diff is shown, so the row takes .row.selected's --selected-inactive.
    private func isSelected(_ file: FileStatus, _ staged: Bool) -> Bool {
        selected?.path == file.path && selected?.staged == staged
    }
}

/// "CHANGES 4", the commit box layout button, the repository's actions (branch with its markers, sync, commit,
/// refresh, more) and close; 34 points tall with a bottom line.
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
                // Settings > Git > Commit box: one box under the list (the default) or one per repository.
                IconButton(width: 24, height: 24, action: {}) {
                    CommitLayoutIcon(perRepo: false)
                }
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
            // .branch is a grid (icon, name, markers) with 2-point gaps; a narrow sidebar hides the name, but its
            // empty column keeps both gaps: 4 points from the icon to the markers.
            HStack(spacing: 4) {
                Icon(name: "branch", size: 12)
                Text(decorations)
                    .font(.system(size: 12, weight: .semibold))
            }
            .padding(.horizontal, 4)
            .frame(height: 20)
            if let head, head.ahead > 0 || head.behind > 0 {
                HStack(spacing: 2) {
                    Icon(name: "sync", size: 13)
                    // .sync-badge: tabular digits, wider than the default ones.
                    Text(head.ahead > 0 ? "\(head.ahead)↑" : "\(head.behind)↓")
                        .font(.system(size: 11).monospacedDigit())
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
