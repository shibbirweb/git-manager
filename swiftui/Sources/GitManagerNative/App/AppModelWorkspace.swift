// Opening a folder as a workspace (repo.svelte.ts openFolders): look for its repositories, make one active as the
// current app picks it, show that one's status, then read the others.

import Foundation
import NativeCore

extension AppModel {
    /// Opens a folder from the UI or at start; a folder that cannot be opened shows why.
    func openFolder(_ folderPath: String) async {
        await openFolders([folderPath])
    }

    /// Opens several folders as one workspace (a saved session or -folders): each one's repositories together.
    func openFolders(_ folderPaths: [String]) async {
        let found = await Task.detached {
            folderPaths.map { WorkspaceModel.find(folderPath: $0) }
        }.value
        let infos = found.compactMap { try? $0.get() }
        guard !infos.isEmpty else {
            // The status read names the problem (no such folder...), as before workspaces.
            await open(repoPath: folderPaths.first ?? "")
            return
        }
        let workspace = WorkspaceModel.shared
        workspace.set(infos)
        let folderRoots = workspace.folders.map(\.root)
        guard let active = WorkspaceRules.pickActive(workspace.repos, folderRoots: folderRoots) else {
            await open(repoPath: folderRoots[0])
            return
        }
        await open(repoPath: active.root)
        await workspace.refresh(skipping: active.root)
    }

    /// Opens folders on the control server's thread and answers once the active repository's status is shown.
    nonisolated static func openFoldersNow(_ folderPaths: [String]) -> Result<StatusSnapshot, BackendError> {
        let infos = folderPaths.compactMap { try? WorkspaceModel.find(folderPath: $0).get() }
        let roots = infos.map(\.root)
        let activeRoot = WorkspaceRules.pickActive(WorkspaceRules.unionRepos(infos), folderRoots: roots)?.root
            ?? roots.first ?? folderPaths.first ?? ""
        Control.onMain {
            if !infos.isEmpty {
                WorkspaceModel.shared.set(infos)
            }
            AppModel.shared.begin(activeRoot)
        }
        let result = readStatus(repoPath: activeRoot)
        Control.onMain {
            AppModel.shared.finish(result)
            Task {
                await WorkspaceModel.shared.refresh(skipping: activeRoot)
            }
        }
        return result
    }

    /// Changes' Refresh All with several repositories: the active one, then the rest.
    func refreshAll() async {
        await refreshStatus()
        await WorkspaceModel.shared.refresh(skipping: repoPath)
    }
}
