// Starts an app as git mergetool would, isolated like AppLauncher.launch: the current app with `merge BASE LOCAL
// REMOTE MERGED` (LaunchMode::MergeTool, which shows MergeToolApp.svelte and runs no control server), the native app
// with -mergeBase, -mergeLocal, -mergeRemote and -mergeMerged (its control server runs as usual).

import Foundation

public struct MergetoolFileSet: Sendable {
    public let base: String
    public let local: String
    public let remote: String
    public let merged: String

    public init(base: String, local: String, remote: String, merged: String) {
        self.base = base
        self.local = local
        self.remote = remote
        self.merged = merged
    }

    /// The four paths of `filePath` (repository-relative) of a repository stopped in a merge, written next to each
    /// other in `folder` as git mergetool names them (app_BASE.ts...), MERGED as the working tree's copy.
    public static func extract(repoPath: String, filePath: String, into folder: String) throws -> MergetoolFileSet {
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
        let name = (filePath as NSString).lastPathComponent
        let stem = (name as NSString).deletingPathExtension, ext = (name as NSString).pathExtension
        let named = { (part: String) in
            (folder as NSString).appendingPathComponent(ext.isEmpty ? "\(stem)_\(part)" : "\(stem)_\(part).\(ext)")
        }
        let files = MergetoolFileSet(base: named("BASE"), local: named("LOCAL"), remote: named("REMOTE"),
                                     merged: (folder as NSString).appendingPathComponent(name))
        for (stage, path) in [(1, files.base), (2, files.local), (3, files.remote)] {
            let shown = try AppLauncher.runData("/usr/bin/git", ["-C", repoPath, "show", ":\(stage):\(filePath)"])
            try shown.write(to: URL(fileURLWithPath: path))
        }
        let merged = try Data(contentsOf: URL(fileURLWithPath: (repoPath as NSString).appendingPathComponent(filePath)))
        try merged.write(to: URL(fileURLWithPath: files.merged))
        return files
    }
}

public struct MergetoolApp {
    public let kind: AppKind
    public let pid: Int32
    /// The native app's control server; nil for the current app, which runs none as git mergetool.
    public let client: McpClient?
    public let readyMs: Int

    public init(kind: AppKind, pid: Int32, client: McpClient?, readyMs: Int) {
        self.kind = kind
        self.pid = pid
        self.client = client
        self.readyMs = readyMs
    }

    public func stop() async {
        await AppLauncher.stop(pid: pid)
    }
}

extension AppLauncher {
    public static func launchMergetool(
        kind: AppKind, home: String, appPath: String, mode: String, files: MergetoolFileSet, timeout: TimeInterval = 60
    ) async throws -> MergetoolApp {
        let manager = FileManager.default
        try manager.createDirectory(atPath: home, withIntermediateDirectories: true)
        let serverFile = serverFilePath(kind, home: home)
        try? manager.removeItem(atPath: serverFile)
        if kind == .current {
            let configDir = (home as NSString).appendingPathComponent(".gitmanager")
            try manager.createDirectory(atPath: configDir, withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: ["theme": mode])
            try data.write(to: URL(fileURLWithPath: (configDir as NSString).appendingPathComponent("settings.json")))
        } else {
            try enableNativeServer(home: home)
        }
        let args = kind == .current
            ? ["merge", files.base, files.local, files.remote, files.merged]
            : ["-mergeBase", files.base, "-mergeLocal", files.local, "-mergeRemote", files.remote,
               "-mergeMerged", files.merged, "-appearance", mode]
        let started = Date()
        let opener = try run("/usr/bin/open", ["-n", "-a", appPath, "--env", "HOME=\(home)", "--args"] + args)
        if opener.status != 0 {
            throw ToolError("Could not open \(appPath): \(opener.output)")
        }
        let elapsed = { Int(Date().timeIntervalSince(started) * 1000) }
        while Date().timeIntervalSince(started) < timeout {
            if kind == .current {
                // No server: the app is ready once its window shows.
                let found = try run("/usr/bin/pgrep", ["-n", "-f", "merge \(files.base)"])
                if let pid = Int32(found.output.trimmingCharacters(in: .whitespacesAndNewlines)),
                   WindowCapture.mainWindowID(pid: pid) != nil {
                    return MergetoolApp(kind: kind, pid: pid, client: nil, readyMs: elapsed())
                }
            } else if let file = ServerFile.read(path: serverFile), let port = file.port, let pid = file.pid,
                      alive(pid) {
                let client = McpClient(port: port, token: file.token)
                if (try? await client.initialize()) != nil,
                   let state = try? await client.call("app", ["action": "get_state"]).structured,
                   let merge = state["merge"] as? [String: Any], merge["loaded"] as? Bool == true,
                   merge["highlighted"] as? Bool == true {
                    return MergetoolApp(kind: kind, pid: pid, client: client, readyMs: elapsed())
                }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw ToolError("\(kind.rawValue): the merge tool did not show within \(Int(timeout)) s")
    }

    /// Runs a program to the end and returns what it wrote to standard output, failing on a non-zero status.
    public static func runData(_ executablePath: String, _ arguments: [String]) throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executablePath)
        process.arguments = arguments
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        try process.run()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            throw ToolError("\(executablePath) \(arguments.joined(separator: " ")) failed")
        }
        return data
    }
}
