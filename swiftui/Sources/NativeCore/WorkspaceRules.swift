// The workspace's pure rules, as the current app has them: which repository is active when a folder opens
// (repo.svelte.ts pickActive), when the header shows the repository pill (Header.svelte showRepoPicker), the commit
// target and its picker (changes/sections.ts), and the names shown for it.

import Foundation

/// A repository of the open workspace (src-tauri RepoInfo).
public struct WorkspaceRepo: Codable, Hashable, Sendable {
    public let root: String
    public let name: String
    /// The repository root relative to its workspace folder with "/" separators; "" for the folder itself.
    public let relativePath: String
    public let submodule: Bool
    public let worktree: Bool

    public init(root: String, name: String, relativePath: String, submodule: Bool = false, worktree: Bool = false) {
        self.root = root
        self.name = name
        self.relativePath = relativePath
        self.submodule = submodule
        self.worktree = worktree
    }
}

/// One opened folder (src-tauri WorkspaceInfo).
public struct WorkspaceInfo: Codable, Sendable {
    public let root: String
    public let name: String
    public let repos: [WorkspaceRepo]

    public init(root: String, name: String, repos: [WorkspaceRepo]) {
        self.root = root
        self.name = name
        self.repos = repos
    }
}

public enum WorkspaceRules {
    /// The remembered repository, else one that is a workspace folder itself, else the first.
    public static func pickActive(
        _ repos: [WorkspaceRepo], folderRoots: [String], remembered: String? = nil
    ) -> WorkspaceRepo? {
        repos.first { $0.root == remembered }
            ?? repos.first { folderRoots.contains($0.root) }
            ?? repos.first
    }

    /// The folders' repositories in folder order, each once (a folder inside another one finds them again).
    public static func unionRepos(_ infos: [WorkspaceInfo]) -> [WorkspaceRepo] {
        var seen = Set<String>()
        var repos: [WorkspaceRepo] = []
        for repo in infos.flatMap(\.repos) where seen.insert(repo.root).inserted {
            repos.append(repo)
        }
        return repos
    }

    /// "acme", or the folder names joined ("acme, design-system") when there are several.
    /// A workspace's name (repo.svelte.ts describeWorkspace): the file's name without its suffix when it has one,
    /// else the first two folders' names and "+N" for the rest.
    public static func workspaceName(_ folderNames: [String], file: String? = nil) -> String {
        if let file {
            return workspaceFileName(file)
        }
        let names = folderNames.prefix(2).joined(separator: ", ")
        return folderNames.count > 2 ? "\(names) +\(folderNames.count - 2)" : names
    }

    /// The endings of a workspace file: the app's own, then VS Code's.
    public static let workspaceFileSuffixes = [".gitmanager-workspace", ".code-workspace"]

    public static func workspaceFileName(_ filePath: String) -> String {
        let base = filePath.split(separator: "/").last.map(String.init) ?? filePath
        guard let suffix = workspaceFileSuffixes.first(where: { base.hasSuffix($0) }) else {
            return base
        }
        return String(base.dropLast(suffix.count))
    }

    /// Save Workspace As: the path with the app's suffix unless it already ends in one.
    public static func workspaceFilePath(_ filePath: String) -> String {
        workspaceFileSuffixes.contains { filePath.hasSuffix($0) } ? filePath : filePath + workspaceFileSuffixes[0]
    }

    /// The header's repository pill only helps when the folder is not simply one repository.
    public static func showsRepoPicker(_ repos: [WorkspaceRepo], workspaceRoot: String?) -> Bool {
        repos.count > 1 || (repos.count == 1 && repos[0].root != workspaceRoot)
    }

    /// The relative path is worth showing next to the name.
    public static func showsRelativePath(_ repo: WorkspaceRepo) -> Bool {
        !repo.relativePath.isEmpty && repo.relativePath != repo.name
    }

    /// The repository a commit goes to: the preferred one, else the active one, else the first.
    public static func commitTarget(
        _ repos: [WorkspaceRepo], preferredRoot: String?, activeRoot: String?
    ) -> WorkspaceRepo? {
        repos.first { $0.root == preferredRoot } ?? repos.first { $0.root == activeRoot } ?? repos.first
    }

    /// The commit target picker offers the repositories with changes, plus the current target.
    public static func commitChoices(
        _ repos: [WorkspaceRepo], changeCounts: [String: Int], targetRoot: String?
    ) -> [WorkspaceRepo] {
        repos.filter { (changeCounts[$0.root] ?? 0) > 0 || $0.root == targetRoot }
    }

    /// A picker entry: "payments-api, 4 staged", with the relative path in parentheses when it says more.
    public static func choiceLabel(_ repo: WorkspaceRepo, staged: Int) -> String {
        let name = showsRelativePath(repo) ? "\(repo.name) (\(repo.relativePath))" : repo.name
        return staged > 0 ? "\(name), \(staged) staged" : name
    }

    /// A repository's status path seen from its workspace folder ("storefront/src/app.ts"), for the Files panel.
    public static func folderPath(_ repo: WorkspaceRepo, filePath: String) -> String {
        repo.relativePath.isEmpty ? filePath : "\(repo.relativePath)/\(filePath)"
    }

    /// The operation badge of a repository header (sections.ts opLabel).
    public static func opLabel(_ kind: String?) -> String? {
        switch kind {
        case "merge":
            return "Merging"
        case "rebase":
            return "Rebasing"
        case "cherryPick":
            return "Cherry-picking"
        case "revert":
            return "Reverting"
        case "other":
            return "In progress"
        default:
            return nil
        }
    }

    /// A row of the repository menu (Header.svelte repoPickerMenu): a check before the active one, three spaces
    /// before the rest, and as hint its path in the folder when that is not just its name, then its change count.
    public static func repoMenuRow(_ repo: WorkspaceRepo, active: Bool, changes: Int) -> (label: String, hint: String) {
        let path = !repo.relativePath.isEmpty && repo.relativePath != repo.name ? repo.relativePath : ""
        let hint = [path, changes > 0 ? "\(changes)" : ""].filter { !$0.isEmpty }.joined(separator: "  ")
        return ((active ? "\u{2713} " : "   ") + repo.name, hint)
    }

    /// "No Changes" folds itself past three clean repositories until it is toggled (layout.svelte.ts).
    public static func cleanListCollapsed(_ cleanCount: Int, toggled: Bool?) -> Bool {
        toggled ?? (cleanCount > 3)
    }
}
