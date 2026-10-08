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
            let stateMatches = state["repoPath"] as? String == repoPath && changedFiles == 3
            check("app get_state", stateMatches, "\(changedFiles.map(String.init) ?? "nil") changed files")

            let status = try await app.client.call("git_status").structured ?? [:]
            let files = (status["files"] as? [[String: Any]] ?? []).compactMap { $0["path"] as? String }.sorted()
            check("git_status", files == ["long.txt", "notes.txt", "readme.md"], files.joined(separator: ", "))

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

            try await checkDiff(app, check: check)
            try await checkFiles(app.client, check: check)

            let shot = try await app.client.call("take_screenshot")
            let image = try shot.image.map(RGBAImage.decode(pngData:))
            check("take_screenshot", (image?.width ?? 0) > 0, image.map { "\($0.width)x\($0.height)" } ?? shot.text)

            try await checkWrites(app.client, check: check)
            try await checkLog(app.client, check: check)
        } catch {
            check("tool calls", false, "\(error)")
        }
        await app.stop()
        print(failures == 0 ? "All checks passed." : "\(failures) checks failed.")
        return failures == 0 ? 0 : 1
    }

    /// The diff of long.txt (lines 10 and 50 of 60 changed): the counter, the previous and next change, fold steps
    /// and "Collapse unchanged", through the `app` tool's `diff` action.
    private static func checkDiff(_ app: RunningApp, check: (String, Bool, String) -> Void) async throws {
        let shown = try await app.client.call("app", ["action": "show_diff", "filePath": "long.txt"])
        let opened = !shown.isError && shown.structured?["collapseUnchanged"] as? Bool == true
        check("show_diff", opened, shown.isError ? shown.text : "")
        func diff(_ args: [String: Any]) async throws -> (counter: String, folds: [[Int]], collapse: Bool) {
            let answer = try await app.client.call("app", args.merging(["action": "diff"]) { first, _ in first })
            let value = answer.structured ?? [:]
            return (value["counter"] as? String ?? answer.text, value["folds"] as? [[Int]] ?? [],
                    value["collapseUnchanged"] as? Bool ?? false)
        }
        let folded = [[1, 6], [14, 46], [54, 61]]
        let start = try await diff([:])
        check("diff opens on the first change, folded", start.counter == "1 of 2" && start.folds == folded,
              "\(start.counter) \(start.folds)")
        var counters: [String] = []
        for step in ["next", "next", "previous"] {
            counters.append(try await diff(["step": step]).counter)
        }
        check("next and previous change", counters == ["2 of 2", "1 of 2", "2 of 2"], counters.joined(separator: ", "))
        let bottom = try await diff(["fold": 1, "edge": "bottom"])
        let top = try await diff(["fold": 1, "edge": "top"])
        let all = try await diff(["fold": 0, "edge": "all"])
        let stepsMatch = bottom.folds.count == 3 && bottom.folds[1] == [14, 36] && top.folds.count == 3
            && top.folds[1] == [24, 36] && all.folds == [[24, 36], [54, 61]]
        check("fold steps", stepsMatch, "\(bottom.folds) \(top.folds) \(all.folds)")
        let off = try await diff(["collapse": "toggle"])
        let on = try await diff(["collapse": "toggle"])
        let collapseWorks = !off.collapse && off.folds.isEmpty && on.collapse && on.folds == folded
        check("collapse unchanged", collapseWorks && off.counter == "1 of 2", "\(off.folds) \(on.folds)")
    }

    /// Stage, unstage and commit through the window (app action=stage, unstage, commit), each answered once the
    /// status is read again.
    private static func checkWrites(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        let paths = { (state: [String: Any], key: String) in (state[key] as? [String] ?? []).sorted() }
        // A passing call answers with the whole state; only a failure's text is worth printing.
        let detail = { (answer: ToolAnswer) in answer.isError ? answer.text : "" }
        let staged = try await client.call("app", ["action": "stage", "filePaths": ["notes.txt"]])
        let afterStage = staged.structured ?? [:]
        check("app stage", !staged.isError && paths(afterStage, "staged") == ["notes.txt"], detail(staged))

        let unstaged = try await client.call("app", ["action": "unstage"])
        let afterUnstage = unstaged.structured ?? [:]
        check("app unstage (the whole group)", paths(afterUnstage, "staged").isEmpty, detail(unstaged))

        let refused = try await client.call("app", ["action": "commit", "message": "Nothing staged"])
        check("commit with nothing staged is refused", refused.isError, refused.text)
        let missing = try await client.call("app", ["action": "stage", "filePaths": ["nope.txt"]])
        check("stage of an unchanged file is refused", missing.isError, missing.text)

        _ = try await client.call("app", ["action": "stage"])
        let committed = try await client.call("app", ["action": "commit", "message": "Smoke commit"])
        let afterCommit = committed.structured ?? [:]
        let toast = (afterCommit["toasts"] as? [[String: Any]] ?? []).last
        let clean = afterCommit["changedFiles"] as? Int == 0 && afterCommit["commitMessage"] as? String == ""
        let toastOk = toast?["title"] as? String == "Committed" && toast?["action"] as? String == "Undo"
        check("app commit", !committed.isError && clean && toastOk, detail(committed))
    }

    /// One commit with readme.md and long.txt, then readme.md and lines 10 and 50 of long.txt changed, and
    /// notes.txt new.
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
        let long = (1...60).map { "line \($0)" }
        try write("readme.md", "# Smoke\n")
        try write("long.txt", long.joined(separator: "\n") + "\n")
        try git(["add", "readme.md", "long.txt"])
        try git(["commit", "-q", "-m", "first"])
        try write("readme.md", "# Smoke\n\nChanged.\n")
        let changed = long.enumerated().map { [9, 49].contains($0.offset) ? "\($0.element) changed" : $0.element }
        try write("long.txt", changed.joined(separator: "\n") + "\n")
        try write("notes.txt", "new\n")
    }
}
