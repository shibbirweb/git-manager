// Opening a folder as a workspace (repo.svelte.ts openFolders): look for its repositories, make one active as the
// current app picks it, show that one's status, then read the others. A workspace without any shows the
// "No git repository" placeholder; Initialize Repository starts one in its folder.

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
            showNoRepository()
            return
        }
        await open(repoPath: active.root)
        await workspace.refresh(skipping: active.root)
    }

    /// Opens folders on the control server's thread and answers once the active repository's status is shown.
    nonisolated static func openFoldersNow(_ folderPaths: [String]) -> Result<StatusSnapshot, BackendError> {
        let infos = folderPaths.compactMap { try? WorkspaceModel.find(folderPath: $0).get() }
        let roots = infos.map(\.root)
        if !infos.isEmpty && WorkspaceRules.unionRepos(infos).isEmpty {
            Control.onMain {
                WorkspaceModel.shared.set(infos)
                AppModel.shared.showNoRepository()
            }
            let message = "No git repository in \(roots.joined(separator: ", "))"
            return .failure(BackendError(kind: "noRepository", message: message))
        }
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

    /// Initialize Repository (repo.svelte.ts initRepository): git init in the folder, then scan again and make the
    /// new repository active.
    func initRepository(_ folderPath: String) async {
        let result = await Task.detached {
            Result { try Backend.call("init_repository", InitRepositoryArgs(folderPath: folderPath)) as CreatedRepo }
        }.value
        switch result {
        case .success(let created):
            await openFolders(WorkspaceModel.shared.folders.map(\.root))
            await setActive(created.root)
            toasts.show(.success, "Initialized a repository in \(created.name)")
        case .failure(let error):
            toasts.show(.error, "Could not initialize repository", detail: Self.describe(error))
        }
    }
}

struct InitRepositoryArgs: Encodable {
    let folderPath: String
}

/// The repository init_repository started (src-tauri/src/git/repo.rs RepoInfo).
struct CreatedRepo: Decodable {
    let root: String
    let name: String
}
