// gm-measure smoke's merge checks: a small repository stopped in a merge with one conflicted file, the conflicts
// list, the merge tool on that file, a chunk applied and undone, and closing again.

import Foundation
import MeasureKit

extension Smoke {
    static func checkMerge(
        _ client: McpClient, workDir: String, check: (String, Bool, String) -> Void
    ) async throws {
        let repoPath = (workDir as NSString).appendingPathComponent("conflicted")
        try makeConflict(at: repoPath)
        let opened = try await client.call("app", ["action": "open_folder", "folderPath": repoPath])
        check("open_folder on a merge with conflicts", !opened.isError, opened.text)
        func merge(_ answer: ToolAnswer) -> [String: Any] {
            (answer.structured ?? [:])["merge"] as? [String: Any] ?? answer.structured ?? [:]
        }
        let list = merge(try await client.call("app", ["action": "open_conflicts"]))
        check("open_conflicts", list["conflictsOpen"] as? Bool == true, "\(list)")
        let tool = merge(try await client.call("app", ["action": "open_merge", "filePath": "app.txt"]))
        let loaded = tool["loaded"] as? Bool == true && tool["status"] as? String == "2 changes left, 1 conflict"
        check("open_merge", loaded, "\(tool["status"] ?? tool["error"] ?? "nil")")
        let applied = merge(try await client.call("app", ["action": "merge", "apply": 1, "side": "theirs"]))
        check("merge apply a chunk", applied["status"] as? String == "1 change left, 1 conflict",
              "\(applied["status"] ?? "nil")")
        let refused = try await client.call("app", ["action": "close_dialog"])
        check("close_dialog keeps an edited merge", refused.isError, refused.text)
        let undone = merge(try await client.call("app", ["action": "merge", "undo": true]))
        check("merge undo", undone["status"] as? String == "2 changes left, 1 conflict", "\(undone["status"] ?? "")")
        let closed = merge(try await client.call("app", ["action": "close_dialog"]))
        check("close_dialog closes the merge tool", closed["path"] is NSNull, "\(closed["path"] ?? "nil")")
    }

    /// app.txt changed on both branches: line 2 differently (a conflict), line 4 only on feature.
    static func makeConflict(at repoPath: String) throws {
        try FileManager.default.createDirectory(atPath: repoPath, withIntermediateDirectories: true)
        func git(_ arguments: [String], allowFailure: Bool = false) throws {
            let result = try AppLauncher.run("/usr/bin/git", ["-c", "user.name=Smoke", "-c", "user.email=s@example.com",
                                                              "-c", "commit.gpgsign=false"] + arguments, in: repoPath)
            if result.status != 0 && !allowFailure {
                throw ToolError("git \(arguments.joined(separator: " ")): \(result.output)")
            }
        }
        func write(_ text: String) throws {
            try text.write(toFile: (repoPath as NSString).appendingPathComponent("app.txt"), atomically: true,
                           encoding: .utf8)
        }
        try git(["init", "-q", "-b", "main"])
        try write("one\ntwo\nthree\nfour\nfive\n")
        try git(["add", "."])
        try git(["commit", "-q", "-m", "base"])
        try git(["checkout", "-q", "-b", "feature"])
        try write("one\nTWO feature\nthree\nFOUR\nfive\n")
        try git(["commit", "-q", "-am", "feature"])
        try git(["checkout", "-q", "main"])
        try write("one\nTWO main\nthree\nfour\nfive\n")
        try git(["commit", "-q", "-am", "main"])
        try git(["merge", "-q", "feature"], allowFailure: true)
    }
}
