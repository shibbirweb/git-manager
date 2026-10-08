// The Changes sidebar (src/lib/views/ChangesView.svelte): the heading row, the grouped file list and the commit box,
// measured in swiftui/Reference/changes-<mode>/changes-head.json, group-headers.json and file-rows.json.

import NativeCore
import SwiftUI

struct ChangesPanel: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var draft = AppModel.shared.draft

    var body: some View {
        let status = model.snapshot?.status
        let groups = FileGroups(status?.files ?? [])
        let state = model.commitState
        VStack(spacing: 0) {
            ChangesHead(
                count: status?.files.count ?? 0, head: status?.head, decorations: groups.decorations,
                busy: model.busy != nil, commitBlocked: CommitRules.blocked(state) != nil,
                commit: { Task { await model.commitFromHead() } },
                refresh: { Task { await model.refreshStatus() } }
            )
            if let errorText = model.errorText {
                Text(errorText)
                    .foregroundStyle(theme.color("--danger"))
                    .padding(12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        if status != nil && groups.isEmpty {
                            CleanTree()
                        }
                        group("Staged", groups.staged, kind: \.staged, staged: true)
                        group("Changes", groups.unstaged, kind: \.unstaged, staged: false)
                    }
                    .padding(.top, 4)
                }
                .scrollIndicators(.never)
            }
            CommitBox(state: state, ahead: status?.head.ahead ?? 0)
        }
    }

    /// A group with its header and rows, then 4 points before the next one; nothing when it is empty.
    @ViewBuilder
    private func group(
        _ title: String, _ files: [FileStatus], kind: KeyPath<FileStatus, String?>, staged: Bool
    ) -> some View {
        if !files.isEmpty {
            GroupHeader(title: title, count: files.count, actions: groupActions(files, staged: staged),
                        busy: model.busy != nil)
            ForEach(files, id: \.path) { file in
                FileRow(file: file, kind: file[keyPath: kind], selected: isSelected(file, staged),
                        actions: rowActions(file, staged: staged))
                    .onTapGesture {
                        Task { await model.showDiff(file, staged: staged) }
                    }
                    // A double click stages or unstages, like Enter on the row.
                    .simultaneousGesture(TapGesture(count: 2).onEnded {
                        act { _ = staged ? await model.unstage([file]) : await model.stage([file]) }
                    })
            }
            Color.clear.frame(height: 4)
        }
    }

    private func groupActions(_ files: [FileStatus], staged: Bool) -> [RowAction] {
        if staged {
            return [RowAction(icon: "minus", title: "Unstage all") { act { await model.unstage(files) } }]
        }
        return [
            RowAction(icon: "discard", title: "Discard all", danger: true) { model.discard(files) },
            RowAction(icon: "plus", title: "Stage all") { act { await model.stage(files) } },
        ]
    }

    private func rowActions(_ file: FileStatus, staged: Bool) -> [RowAction] {
        if staged {
            return [RowAction(icon: "minus", title: "Unstage") { act { await model.unstage([file]) } }]
        }
        return [
            RowAction(icon: "discard", title: "Discard changes", danger: true) { model.discard([file]) },
            RowAction(icon: "plus", title: "Stage") { act { await model.stage([file]) } },
        ]
    }

    private func act(_ work: @escaping @MainActor () async -> Void) {
        Task {
            await work()
        }
    }

    /// The list never has focus while the diff is shown, so the row takes .row.selected's --selected-inactive.
    private func isSelected(_ file: FileStatus, _ staged: Bool) -> Bool {
        model.openDiff?.filePath == file.path && model.openDiff?.staged == staged
    }
}

/// "Working tree clean": a 36-point tinted circle with a check, centered under the list's top padding.
private struct CleanTree: View {
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: 8) {
            Icon(name: "check", size: 18)
                .foregroundStyle(theme.color("--success"))
                .frame(width: 36, height: 36)
                .background(Circle().fill(theme.over("--success", 0.14, on: "--panel")))
            Text("Working tree clean")
                .foregroundStyle(theme.color("--text-dim"))
        }
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
    }
}
