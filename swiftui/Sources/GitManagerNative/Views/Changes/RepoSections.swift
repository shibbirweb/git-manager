// Changes with several repositories (ChangesView.svelte multiRepo): a section for each repository with changes, in
// workspace order, 2 points apart; a line for the clean ones after them.

import NativeCore
import SwiftUI

struct RepoSections: View {
    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var workspace = WorkspaceModel.shared

    var body: some View {
        let changed = workspace.repos.filter { workspace.changeCount($0.root) > 0 }
        if changed.isEmpty {
            CleanTree(text: "No changes in \(workspace.repos.count) repositories")
        }
        ForEach(Array(changed.enumerated()), id: \.element.root) { index, repo in
            if let status = workspace.statuses[repo.root] {
                RepoSection(
                    repo: repo, status: status, active: repo.root == model.repoPath,
                    collapsed: workspace.collapsed.contains(repo.root), busy: model.busy != nil,
                    toggle: { workspace.toggleCollapsed(repo.root) },
                    commit: { act(repo.root) { await model.commitFromHead() } },
                    refresh: { act(repo.root) { await model.refreshStatus() } }
                ) {
                    ChangeGroups(repoRoot: repo.root, groups: FileGroups(status.files), nested: true)
                }
                .padding(.top, index > 0 ? 2 : 0)
            }
        }
    }

    private func act(_ repoRoot: String, _ work: @escaping @MainActor () async -> Void) {
        Task {
            await model.setActive(repoRoot)
            await work()
        }
    }
}
