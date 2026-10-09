// The open workspace (src/lib/stores/repo.svelte.ts): its folders, the repositories found in them (bridge
// `open_workspace`) and each repository's last status. The active repository's status is also AppModel.snapshot,
// so every screen built for one repository keeps working; Changes, the header and the Files panel read the rest here.

import Foundation
import NativeCore

private struct OpenWorkspaceArgs: Encodable {
    let folderPath: String
}

@MainActor
final class WorkspaceModel: ObservableObject {
    static let shared = WorkspaceModel()

    @Published private(set) var folders: [WorkspaceInfo] = []
    /// The workspace file it was opened from or saved to; it names the workspace.
    @Published private(set) var file: String?
    @Published private(set) var repos: [WorkspaceRepo] = []
    /// Each repository's last status by its root, filled in as the statuses arrive.
    @Published private(set) var statuses: [String: RepoStatus] = [:]
    /// Repositories whose section in Changes is folded (the header's chevron).
    @Published private(set) var collapsed: Set<String> = []
    /// "No Changes" folded or open once toggled; until then it folds itself past three repositories
    /// (layout.svelte.ts cleanCollapsed).
    @Published private(set) var cleanCollapsed: Bool?
    private var hashes: [String: String] = [:]

    /// The first folder, where the Files panel and the breadcrumb start.
    var root: String? {
        folders.first?.root
    }

    var name: String? {
        folders.isEmpty ? nil : WorkspaceRules.workspaceName(folders.map(\.name), file: file)
    }

    /// Several repositories: Changes shows a section for each.
    var multiRepo: Bool {
        repos.count > 1
    }

    var showsRepoPicker: Bool {
        WorkspaceRules.showsRepoPicker(repos, workspaceRoot: root)
    }

    var totalChanges: Int {
        repos.reduce(0) { $0 + (statuses[$1.root]?.files.count ?? 0) }
    }

    func toggleCollapsed(_ repoRoot: String) {
        if collapsed.contains(repoRoot) {
            collapsed.remove(repoRoot)
        } else {
            collapsed.insert(repoRoot)
        }
    }

    /// Save Workspace As linked the open workspace to `filePath`.
    func linkFile(_ filePath: String) {
        file = folders.isEmpty ? nil : filePath
    }

    func isCleanCollapsed(_ cleanCount: Int) -> Bool {
        WorkspaceRules.cleanListCollapsed(cleanCount, toggled: cleanCollapsed)
    }

    func toggleClean(_ cleanCount: Int) {
        cleanCollapsed = !isCleanCollapsed(cleanCount)
    }

    func repo(at repoRoot: String?) -> WorkspaceRepo? {
        repos.first { $0.root == repoRoot }
    }

    func changeCount(_ repoRoot: String) -> Int {
        statuses[repoRoot]?.files.count ?? 0
    }

    /// Looks for the repositories in a folder, on the caller's thread.
    nonisolated static func find(folderPath: String) -> Result<WorkspaceInfo, BackendError> {
        do {
            return .success(try Backend.call("open_workspace", OpenWorkspaceArgs(folderPath: folderPath)))
        } catch let error as BackendError {
            return .failure(error)
        } catch {
            return .failure(BackendError(kind: "bridge", message: error.localizedDescription))
        }
    }

    /// The folders replace the workspace (a folder given twice counts once); statuses fill in afterwards.
    func set(_ infos: [WorkspaceInfo], file: String? = nil) {
        self.file = infos.isEmpty ? nil : file
        var seen = Set<String>()
        folders = infos.filter { seen.insert($0.root).inserted }
        repos = WorkspaceRules.unionRepos(folders)
        statuses = [:]
        hashes = [:]
        collapsed = []
    }

    func record(repoRoot: String, snapshot: StatusSnapshot) {
        hashes[repoRoot] = snapshot.hash
        if let status = snapshot.status {
            statuses[repoRoot] = status
        }
    }

    /// Reads every repository's status but `skipping` (the active one, read by AppModel), one after another as the
    /// current app's loadAllChanges does; an unchanged status keeps the one on screen.
    func refresh(skipping activeRoot: String?) async {
        for repo in repos where repo.root != activeRoot {
            let known = hashes[repo.root]
            let result = await Task.detached {
                AppModel.readStatus(repoPath: repo.root, knownHash: known)
            }.value
            guard self.repo(at: repo.root) != nil, case .success(let snapshot) = result else {
                continue
            }
            record(repoRoot: repo.root, snapshot: snapshot)
        }
        FilesModel.shared.updateTones(toneFiles())
    }

    /// Every changed file with its repository's root, for the Files panel's tones.
    func toneFiles() -> [(repoRoot: String, file: FileStatus)] {
        repos.flatMap { repo in
            (statuses[repo.root]?.files ?? []).map { (repoRoot: repo.root, file: $0) }
        }
    }
}
