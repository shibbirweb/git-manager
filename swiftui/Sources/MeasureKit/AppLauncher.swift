// Starts the current app or the native app in isolation, the same way for both: launched by macOS
// (`open -n`), so it counts its own memory exactly, with HOME pointing at a throwaway folder, so its
// settings, state and server file never touch the real ~/.gitmanager. Both apps get a settings.json
// that turns their MCP server and command line tool on, on a free port (the default, 48731, is
// usually taken by the real app); the native app's keeps the values a run wrote there first.

import AppKit
import Darwin
import Foundation

public enum AppKind: String, CaseIterable {
    case current
    case native
}

public struct RunningApp {
    public let kind: AppKind
    public let pid: Int32
    public let client: McpClient
    /// Milliseconds from launch until the server answered.
    public let serverMs: Int
    /// Milliseconds from launch until the folder's status was on screen.
    public let readyMs: Int

    public func stop() async {
        await AppLauncher.stop(pid: pid)
    }
}

public enum AppLauncher {
    /// `swiftuiDir` is the swiftui/ folder of the checkout. The current app is the local build when there is one
    /// (`bun tauri build --bundles app`: develop plus fixes not released yet, the reference the user chose), else
    /// the installed release.
    public static func defaultAppPath(_ kind: AppKind, swiftuiDir: String) -> String {
        switch kind {
        case .current:
            let localBuild = ((swiftuiDir as NSString).deletingLastPathComponent as NSString)
                .appendingPathComponent("src-tauri/target/release/bundle/macos/Git Manager.app")
            if FileManager.default.fileExists(atPath: localBuild) {
                return localBuild
            }
            return "/Applications/Git Manager.app"
        case .native:
            return (swiftuiDir as NSString).appendingPathComponent("build/Git Manager Native.app")
        }
    }

    public static func serverFilePath(_ kind: AppKind, home: String) -> String {
        switch kind {
        case .current:
            return (home as NSString).appendingPathComponent(".gitmanager/mcp.json")
        case .native:
            return (home as NSString).appendingPathComponent(".gitmanager-native/.gitmanager/mcp.json")
        }
    }

    public static func launch(
        kind: AppKind,
        home: String,
        /// "" starts both apps without a folder: the welcome screen.
        folderPath: String,
        appPath: String,
        /// Extra settings.json values for the current app, such as ["theme": "dark"].
        settings extraSettings: [String: Any] = [:],
        /// "light" or "dark" for both apps: the current app's theme setting, the native app's -appearance.
        mode: String? = nil,
        /// Extra launch arguments for the native app.
        nativeArguments: [String] = [],
        /// More workspace folders after `folderPath`, opened together as one workspace.
        extraFolders: [String] = [],
        /// state.json values for both apps, such as recentFolders (the native app's ~/.gitmanager-native/state.json).
        state extraState: [String: Any] = [:],
        /// A workspace file both apps open instead of the folders.
        workspaceFile: String? = nil,
        /// Ready once the control server answers, whatever the window shows (a restored session).
        readyOnAnswer: Bool = false,
        timeout: TimeInterval = 60
    ) async throws -> RunningApp {
        let files = FileManager.default
        let serverFile = serverFilePath(kind, home: home)
        try? files.removeItem(atPath: serverFile)
        try files.createDirectory(atPath: home, withIntermediateDirectories: true)
        if kind == .current {
            let configDir = (home as NSString).appendingPathComponent(".gitmanager")
            try files.createDirectory(atPath: configDir, withIntermediateDirectories: true)
            var settings: [String: Any] = ["mcpEnabled": true, "cliEnabled": true, "mcpPort": try freePort()]
            if let mode {
                settings["theme"] = mode
            }
            settings.merge(extraSettings) { _, extra in extra }
            let data = try JSONSerialization.data(withJSONObject: settings)
            try data.write(to: URL(fileURLWithPath: (configDir as NSString).appendingPathComponent("settings.json")))
            try writeSession(configDir: configDir, folderPaths: folderPath.isEmpty ? [] : [folderPath] + extraFolders,
                             workspaceFile: workspaceFile, extra: extraState)
        } else {
            try enableNativeServer(home: home)
        }
        if kind == .native && !extraState.isEmpty {
            let nativeDir = (home as NSString).appendingPathComponent(".gitmanager-native")
            try files.createDirectory(atPath: nativeDir, withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: extraState)
            try data.write(to: URL(fileURLWithPath: (nativeDir as NSString).appendingPathComponent("state.json")))
        }
        var nativeArgs = (folderPath.isEmpty ? [] : ["-folder", folderPath]) + (mode.map { ["-appearance", $0] } ?? [])
            + nativeArguments
        if let placed = MeasureScreen.centered(windowSize) {
            nativeArgs += ["-windowFrame", NSStringFromRect(placed.cocoaFrame)]
        }
        if let workspaceFile {
            nativeArgs += ["-workspaceFile", workspaceFile]
        }
        if !extraFolders.isEmpty {
            // An old-style property list array, which is what macOS parses a -key value argument as.
            let quoted = ([folderPath] + extraFolders).map { folder in
                "\"" + folder.replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "\"", with: "\\\"") + "\""
            }
            nativeArgs += ["-folders", "(" + quoted.joined(separator: ", ") + ")"]
        }
        // The current app opens the folder from its saved session, which also puts the window on the measuring
        // screen; a folder on its command line would skip the session and open where macOS likes.
        let appArgs = kind == .current ? [] : nativeArgs
        let started = Date()
        let opener = try run("/usr/bin/open", ["-n", "-a", appPath, "--env", "HOME=\(home)", "--args"] + appArgs)
        if opener.status != 0 {
            throw ToolError("Could not open \(appPath): \(opener.output)")
        }
        let elapsed = { Int(Date().timeIntervalSince(started) * 1000) }

        var connected: (client: McpClient, pid: Int32, serverMs: Int)?
        while connected == nil && Date().timeIntervalSince(started) < timeout {
            if let file = ServerFile.read(path: serverFile), let port = file.port, let pid = file.pid, alive(pid) {
                let client = McpClient(port: port, token: file.token)
                // The server file can appear a moment before the server answers.
                if (try? await client.initialize()) != nil {
                    connected = (client, pid, elapsed())
                }
            }
            if connected == nil {
                try await Task.sleep(nanoseconds: 100_000_000)
            }
        }
        guard let connected else {
            throw ToolError("\(kind.rawValue): no server answer within \(Int(timeout)) s (\(serverFile))")
        }

        while Date().timeIntervalSince(started) < timeout {
            var ready = readyOnAnswer
            if !ready {
                ready = (try? await isReady(kind, connected.client, welcome: folderPath.isEmpty)) == true
            }
            if ready {
                // Only ever on the built-in display (the user works on the other one).
                if WindowPlacement.ensureOnMeasureScreen(pid: connected.pid, size: windowSize) {
                    print("\(kind.rawValue): the window opened off the measuring screen; moved it there")
                    try await Task.sleep(nanoseconds: 500_000_000)
                }
                return RunningApp(
                    kind: kind,
                    pid: connected.pid,
                    client: connected.client,
                    serverMs: connected.serverMs,
                    readyMs: elapsed()
                )
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        await stop(pid: connected.pid)
        throw ToolError("\(kind.rawValue): \(folderPath) did not finish loading within \(Int(timeout)) s")
    }

    /// Turns the native app's MCP server and command line tool on, on a free port unless a run chose one, keeping
    /// the other values in its ~/.gitmanager-native/settings.json.
    static func enableNativeServer(home: String) throws {
        let folder = (home as NSString).appendingPathComponent(".gitmanager-native")
        try FileManager.default.createDirectory(atPath: folder, withIntermediateDirectories: true)
        let path = (folder as NSString).appendingPathComponent("settings.json")
        let existing = (try? Data(contentsOf: URL(fileURLWithPath: path)))
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
        let port = try existing["mcpPort"] ?? freePort()
        let settings = existing.merging(["mcpEnabled": true, "cliEnabled": true, "mcpPort": port]) { _, on in
            on
        }
        let data = try JSONSerialization.data(withJSONObject: settings, options: [.sortedKeys])
        try data.write(to: URL(fileURLWithPath: path))
    }

    /// Both apps' default window, in points.
    public static let windowSize = CGSize(width: 1400, height: 880)

    /// The current app's state.json: one window on `folderPaths`, at its default size on the measuring screen
    /// (src-tauri/src/windows.rs restores it at start: "windows", outer position and inner size in points).
    static func writeSession(
        configDir: String, folderPaths: [String], workspaceFile: String? = nil, extra: [String: Any] = [:]
    ) throws {
        var window: [String: Any] = ["folders": folderPaths, "workspaceFile": workspaceFile ?? NSNull()]
        if let placed = MeasureScreen.centered(windowSize) {
            window["bounds"] = [
                "x": placed.topLeft.x, "y": placed.topLeft.y,
                "width": windowSize.width, "height": windowSize.height,
            ]
        }
        let state = extra.merging(["windows": [window]]) { _, session in session }
        let data = try JSONSerialization.data(withJSONObject: state)
        try data.write(to: URL(fileURLWithPath: (configDir as NSString).appendingPathComponent("state.json")))
    }

    /// True once the app shows the folder's status, so both apps are measured in the same state.
    static func isReady(_ kind: AppKind, _ client: McpClient, welcome: Bool = false) async throws -> Bool {
        if welcome {
            // The welcome screen: no workspace open.
            let state = kind == .current
                ? try await client.call("get_app_state").structured ?? [:]
                : try await client.call("app", ["action": "get_state"]).structured ?? [:]
            if kind == .current {
                return state["workspace"] == nil || state["workspace"] is NSNull
            }
            return ((state["workspace"] as? [String: Any])?["folders"] as? [Any])?.isEmpty ?? true
        }
        switch kind {
        // Ready once the active repository's branch shows, or once a folder without any repository is open.
        case .native:
            let state = try await client.call("app", ["action": "get_state"]).structured ?? [:]
            let workspace = state["workspace"] as? [String: Any]
            let noRepository = (workspace?["folders"] as? [Any])?.isEmpty == false
                && (workspace?["repos"] as? [Any])?.isEmpty == true
            return state["loading"] as? Bool == false && (state["branch"] is String || noRepository)
        case .current:
            let state = try await client.call("get_app_state").structured ?? [:]
            let active = state["activeRepository"] as? [String: Any]
            let noRepository = state["workspace"] is [String: Any]
                && (state["repositories"] as? [Any])?.isEmpty == true
            return (active?["branch"] is String && active?["busy"] as? Bool != true) || noRepository
        }
    }

    static func stop(pid: Int32) async {
        if alive(pid) {
            kill(pid, SIGTERM)
        }
        for _ in 0..<50 where alive(pid) {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        if alive(pid) {
            kill(pid, SIGKILL)
        }
    }

    static func alive(_ pid: Int32) -> Bool {
        kill(pid, 0) == 0
    }

    /// A loopback port nothing listens on right now.
    public static func freePort() throws -> Int {
        let socketHandle = socket(AF_INET, SOCK_STREAM, 0)
        guard socketHandle >= 0 else {
            throw ToolError("Could not open a socket")
        }
        defer {
            close(socketHandle)
        }
        var address = sockaddr_in()
        address.sin_family = sa_family_t(AF_INET)
        address.sin_addr.s_addr = inet_addr("127.0.0.1")
        address.sin_port = 0
        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        let bound = withUnsafeMutablePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
                bind(socketHandle, socketAddress, length) == 0 && getsockname(socketHandle, socketAddress, &length) == 0
            }
        }
        guard bound else {
            throw ToolError("Could not find a free port")
        }
        return Int(UInt16(bigEndian: address.sin_port))
    }

    /// Runs a program to the end and returns its exit status and combined output.
    @discardableResult
    public static func run(
        _ executablePath: String, _ arguments: [String], in directoryPath: String? = nil
    ) throws -> (status: Int32, output: String) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executablePath)
        process.arguments = arguments
        if let directoryPath {
            process.currentDirectoryURL = URL(fileURLWithPath: directoryPath)
        }
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        try process.run()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        return (process.terminationStatus, String(decoding: data, as: UTF8.self))
    }
}
