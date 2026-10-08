// gm-measure smoke: starts the built native app on a small test repository and checks every control tool end
// to end. CI runs it after the build (.github/workflows/native.yml). Exit code 0 when every check passes, 1
// otherwise.

import Foundation
import MeasureKit

enum Smoke {
    static func run(_ arguments: [String]) async throws -> Int32 {
        var arguments = arguments
        let appPath = option("--app", in: &arguments)
            ?? AppLauncher.defaultAppPath(.native, swiftuiDir: swiftuiDir)
        guard arguments.isEmpty else {
            print(usage)
            return 2
        }
        let processID = ProcessInfo.processInfo.processIdentifier
        let workDir = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-smoke-\(processID)")
        let repoPath = (workDir as NSString).appendingPathComponent("repo")
        try makeRepository(at: repoPath)

        let home = (workDir as NSString).appendingPathComponent("home")
        let app = try await AppLauncher.launch(kind: .native, home: home, folderPath: repoPath, appPath: appPath)
        var failures = 0
        func check(_ name: String, _ passed: Bool, _ detail: String = "") {
            print("\(passed ? "PASS" : "FAIL")  \(name)\(detail.isEmpty ? "" : ": \(detail)")")
            if !passed {
                failures += 1
            }
        }
        do {
            print("Started in \(app.readyMs) ms (server \(app.serverMs) ms)")
            let tools = try await app.client.listTools()
            let expected = ["get_app_info", "app", "git_status", "get_memory_usage", "sample_memory", "take_screenshot"]
            check("tools/list", Set(expected).isSubset(of: Set(tools)), tools.joined(separator: ", "))

            let info = try await app.client.call("get_app_info").structured ?? [:]
            check("get_app_info", info["name"] as? String == "Git Manager Native", "\(info["name"] ?? "nil")")

            let state = try await app.client.call("app", ["action": "get_state"]).structured ?? [:]
            let changedFiles = state["changedFiles"] as? Int
            let stateMatches = state["repoPath"] as? String == repoPath && changedFiles == 2
            check("app get_state", stateMatches, "\(changedFiles.map(String.init) ?? "nil") changed files")

            let status = try await app.client.call("git_status").structured ?? [:]
            let files = (status["files"] as? [[String: Any]] ?? []).compactMap { $0["path"] as? String }.sorted()
            check("git_status", files == ["notes.txt", "readme.md"], files.joined(separator: ", "))

            let notRepo = try await app.client.call("app", ["action": "open_folder", "folderPath": workDir])
            check("open_folder on a plain folder fails", notRepo.isError, notRepo.text)
            let reopened = try await app.client.call("app", ["action": "open_folder", "folderPath": repoPath])
            let branch = reopened.structured?["branch"] as? String
            check("open_folder on the repository", !reopened.isError && branch == "main")

            let memory = try await app.client.call("get_memory_usage").structured ?? [:]
            let totalMb = memory["totalMb"] as? Double ?? 0
            check("get_memory_usage", totalMb > 0, "\(totalMb) MB")

            let sampleArgs = ["durationMs": 1000, "intervalMs": 250]
            let samples = try await app.client.call("sample_memory", sampleArgs).structured ?? [:]
            check("sample_memory", (samples["samples"] as? [Any])?.count ?? 0 >= 4)

            let shot = try await app.client.call("take_screenshot")
            let image = try shot.image.map(RGBAImage.decode(pngData:))
            check("take_screenshot", (image?.width ?? 0) > 0, image.map { "\($0.width)x\($0.height)" } ?? shot.text)
        } catch {
            check("tool calls", false, "\(error)")
        }
        await app.stop()
        print(failures == 0 ? "All checks passed." : "\(failures) checks failed.")
        return failures == 0 ? 0 : 1
    }

    /// One commit with readme.md, then readme.md changed and notes.txt new.
    static func makeRepository(at repoPath: String) throws {
        try FileManager.default.createDirectory(atPath: repoPath, withIntermediateDirectories: true)
        let git = { (arguments: [String]) throws in
            let result = try AppLauncher.run("/usr/bin/git", arguments, in: repoPath)
            if result.status != 0 {
                throw ToolError("git \(arguments.joined(separator: " ")): \(result.output)")
            }
        }
        let write = { (fileName: String, text: String) throws in
            let filePath = (repoPath as NSString).appendingPathComponent(fileName)
            try text.write(toFile: filePath, atomically: true, encoding: .utf8)
        }
        try git(["init", "-q", "-b", "main"])
        try git(["config", "user.name", "Smoke Test"])
        try git(["config", "user.email", "smoke@example.com"])
        try write("readme.md", "# Smoke\n")
        try git(["add", "readme.md"])
        try git(["commit", "-q", "-m", "first"])
        try write("readme.md", "# Smoke\n\nChanged.\n")
        try write("notes.txt", "new\n")
    }
}
