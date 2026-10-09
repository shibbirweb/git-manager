// A repository's file groups in Changes (RepoSection.svelte fileGroup): Conflicts, Staged and Changes, each a header
// and its rows. A repository other than the active one becomes active first, so every write and diff keeps working
// on AppModel's repository.

import SwiftUI

struct ChangeGroups: View {
    @ObservedObject private var model = AppModel.shared

    let repoRoot: String
    let groups: FileGroups
    /// Inside a repository's section (several repositories): 12 points further in.
    var nested = false

    var body: some View {
        ConflictsGroup(files: groups.conflicts, nested: nested, activate: activate)
        group("Staged", groups.staged, kind: \.staged, staged: true)
        group("Changes", groups.unstaged, kind: \.unstaged, staged: false)
    }

    /// A group with its header and rows, then 4 points before the next one; nothing when it is empty.
    @ViewBuilder
    private func group(
        _ title: String, _ files: [FileStatus], kind: KeyPath<FileStatus, String?>, staged: Bool
    ) -> some View {
        if !files.isEmpty {
            GroupHeader(title: title, count: files.count, actions: groupActions(files, staged: staged),
                        busy: model.busy != nil, nested: nested)
            ForEach(files, id: \.path) { file in
                FileRow(file: file, kind: file[keyPath: kind], selected: isSelected(file, staged),
                        actions: rowActions(file, staged: staged), nested: nested)
                    .onTapGesture {
                        act { await model.showDiff(file, staged: staged) }
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
            RowAction(icon: "discard", title: "Discard all", danger: true) { act { model.discard(files) } },
            RowAction(icon: "plus", title: "Stage all") { act { await model.stage(files) } },
        ]
    }

    private func rowActions(_ file: FileStatus, staged: Bool) -> [RowAction] {
        if staged {
            return [RowAction(icon: "minus", title: "Unstage") { act { await model.unstage([file]) } }]
        }
        return [
            RowAction(icon: "discard", title: "Discard changes", danger: true) { act { model.discard([file]) } },
            RowAction(icon: "plus", title: "Stage") { act { await model.stage([file]) } },
        ]
    }

    private func activate() async {
        await model.setActive(repoRoot)
    }

    private func act(_ work: @escaping @MainActor () async -> Void) {
        Task {
            await activate()
            await work()
        }
    }

    /// The list never has focus while the diff is shown, so the row takes .row.selected's --selected-inactive.
    private func isSelected(_ file: FileStatus, _ staged: Bool) -> Bool {
        model.repoPath == repoRoot && model.openDiff?.filePath == file.path && model.openDiff?.staged == staged
    }
}
