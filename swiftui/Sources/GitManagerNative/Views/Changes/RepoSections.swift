// Changes with several repositories (ChangesView.svelte multiRepo): a section for each repository with changes, in
// workspace order, 2 points apart; the clean ones listed after them (CleanRepoList).

import NativeCore
import SwiftUI

struct RepoSections: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var workspace: WorkspaceModel

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
        // Clean, or still reading their status.
        let clean = workspace.repos.filter { workspace.changeCount($0.root) == 0 }
        if !clean.isEmpty {
            CleanRepoList(repos: clean, afterSection: !changed.isEmpty)
        }
    }

    private func act(_ repoRoot: String, _ work: @escaping @MainActor () async -> Void) {
        Task {
            await model.setActive(repoRoot)
            await work()
        }
    }
}
