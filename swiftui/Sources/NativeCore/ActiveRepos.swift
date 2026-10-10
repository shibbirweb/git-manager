// The active repository each workspace had last (state.json activeRepos, repo.svelte.ts pickActive and
// setActiveRepo): keyed by the workspace's id, which is its file when it has one, else its folders' roots.

import Foundation

public enum ActiveRepos {
    public static let key = "activeRepos"

    /// describeWorkspace's id: the workspace file, else the folder roots one per line.
    public static func workspaceId(folderRoots: [String], file: String?) -> String {
        file ?? folderRoots.joined(separator: "\n")
    }

    /// state.json's map, keeping only string values (settingsData.ts parseState).
    public static func parse(_ value: Any?) -> [String: String] {
        guard let object = value as? [String: Any] else {
            return [:]
        }
        return object.compactMapValues { $0 as? String }
    }

    /// Save Workspace As gave the workspace a new id: its remembered repository (else the active one) moves along.
    public static func moved(
        _ repos: [String: String], from previousId: String, to workspaceId: String, activeRoot: String?
    ) -> [String: String] {
        guard let repoRoot = repos[previousId] ?? activeRoot else {
            return repos
        }
        var next = repos
        next[workspaceId] = repoRoot
        return next
    }
}
