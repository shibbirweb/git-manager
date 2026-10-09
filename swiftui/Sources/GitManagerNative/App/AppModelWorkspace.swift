// Opening a folder as a workspace (repo.svelte.ts openFolders): look for its repositories, make one active as the
// current app picks it, show that one's status, then read the others.

import Foundation
import NativeCore

extension AppModel {
    /// Opens a folder from the UI or at start; a folder that cannot be opened shows why.
    func openFolder(_ folderPath: String) async {
        let found = await Task.detached {
            WorkspaceModel.find(folderPath: folderPath)
        }.value
        guard case .success(let info) = found else {
            // The status read names the problem (no such folder...), as before workspaces.
            await open(repoPath: folderPath)
            return
        }
        let workspace = WorkspaceModel.shared
        workspace.set(info)
        guard let active = WorkspaceRules.pickActive(info.repos, folderRoots: [info.root]) else {
            await open(repoPath: info.root)
            return
        }
        await open(repoPath: active.root)
        await workspace.refresh(skipping: active.root)
    }

    /// Opens a folder on the control server's thread and answers once the active repository's status is shown.
    nonisolated static func openFolderNow(_ folderPath: String) -> Result<StatusSnapshot, BackendError> {
        let found = WorkspaceModel.find(folderPath: folderPath)
        var activeRoot = folderPath
        if case .success(let info) = found {
            activeRoot = WorkspaceRules.pickActive(info.repos, folderRoots: [info.root])?.root ?? info.root
        }
        Control.onMain {
            if case .success(let info) = found {
                WorkspaceModel.shared.set(info)
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
