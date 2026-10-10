// gm-measure smoke: the active repository each workspace had last (state.json activeRepos). A folder holding two
// repositories, the second made active, another folder opened in between: opening the first folder again shows
// the second repository, and state.json keeps it under the folder's id.

import Foundation
import MeasureKit

extension Smoke {
    static func checkActiveRepo(_ client: McpClient, workDir: String, home: String, repoPath: String,
                                check: (String, Bool, String) -> Void) async throws {
        let folderPath = (workDir as NSString).appendingPathComponent("two-repos")
        for name in ["first", "second"] {
            try makeRepository(at: (folderPath as NSString).appendingPathComponent(name))
        }
        let realFolder = realPath(folderPath)
        let second = (realFolder as NSString).appendingPathComponent("second")
        _ = try await client.call("app", ["action": "open_folder", "folderPath": folderPath])
        let picked = try await client.call("app", ["action": "set_active_repo", "repoRoot": second])
        let pickedRoot = picked.structured?["repoPath"] as? String
        check("set_active_repo", pickedRoot == second, pickedRoot ?? picked.text)
        _ = try await client.call("app", ["action": "open_folder", "folderPath": repoPath])
        let again = try await client.call("app", ["action": "open_folder", "folderPath": folderPath])
        let active = again.structured?["repoPath"] as? String
        check("a workspace opens on the repository it had last", active == second, active ?? "nil")
        let statePath = (home as NSString).appendingPathComponent(".gitmanager-native/state.json")
        let saved = (try? JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: statePath))))
            as? [String: Any]
        let remembered = (saved?["activeRepos"] as? [String: String])?[realFolder]
        check("state.json keeps it under activeRepos", remembered == second, remembered ?? "nil")
    }
}
