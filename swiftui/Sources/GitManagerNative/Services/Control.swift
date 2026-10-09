// The window's side of the control server (swiftui/bridge/src/control.rs): the bridge calls
// `answer` on its own thread for requests that need the UI, and the reply goes back as JSON.
// Lets `HOME=~/.gitmanager-native git-manager cli ...` drive and measure this app.

import AppKit
import Foundation
import GMBridge

enum Control {
    /// Starts the server once at launch; returns its port, or nil.
    @discardableResult
    static func start() -> Int? {
        let port = gm_control_start { requestPointer in
            let requestText = requestPointer.map { String(cString: $0) } ?? "{}"
            return strdup(Control.answer(requestText))
        }
        return port > 0 ? Int(port) : nil
    }

    /// Runs on the server's thread, never the main one, so waiting for the main thread is safe.
    private static func answer(_ requestText: String) -> String {
        let request = (try? JSONSerialization.jsonObject(with: Data(requestText.utf8))) as? [String: Any] ?? [:]
        let action = request["action"] as? String ?? ""
        let args = request["args"] as? [String: Any] ?? [:]
        switch action {
        case "get_state":
            return reply(ok: true, structured: onMain { state() })
        case "screenshot":
            let windowNumber = onMain { mainWindow()?.windowNumber ?? 0 }
            guard windowNumber > 0 else {
                return reply(ok: false, text: "No window is open")
            }
            guard let png = capture(windowNumber: windowNumber) else {
                return reply(ok: false, text: "Could not capture the window")
            }
            return reply(ok: true, structured: ["pngBase64": png.base64EncodedString()])
        case "show_diff":
            guard let filePath = args["filePath"] as? String else {
                return reply(ok: false, text: "filePath is required")
            }
            let staged = args["staged"] as? Bool ?? false
            let found = onMain { AppModel.shared.snapshot?.status?.files.first { $0.path == filePath } }
            guard let file = found else {
                return reply(ok: false, text: "\(filePath) has no changes")
            }
            let semaphore = DispatchSemaphore(value: 0)
            Task { @MainActor in
                await AppModel.shared.showDiff(file, staged: staged)
                semaphore.signal()
            }
            semaphore.wait()
            return reply(ok: true, structured: onMain { state() })
        case "diff":
            return diff(args)
        case "open_file":
            return openFile(args)
        case "editor_command":
            return editorCommand(args)
        case "scroll":
            return scroll(speed: args["speed"] as? Double ?? 80, rounds: args["rounds"] as? Int ?? 1)
        case "open_folder":
            // folderPath, or folderPaths for a workspace of several folders.
            let folderPaths = (args["folderPaths"] as? [String]) ?? [args["folderPath"] as? String].compactMap { $0 }
            guard !folderPaths.isEmpty, !folderPaths.contains(where: \.isEmpty) else {
                return reply(ok: false, text: "folderPath is required")
            }
            let result = AppModel.openFoldersNow(folderPaths)
            if case .failure(let error) = result {
                return reply(ok: false, text: error.message, structured: onMain { state() })
            }
            return reply(ok: true, structured: onMain { state() })
        case "toggle_repo", "set_active_repo":
            return workspaceAction(action, args)
        case "stage", "unstage", "commit":
            return git(action, args)
        case "show_log":
            return showLog(args)
        case "open_settings":
            return settings(action, args)
        case "quick_open", "search":
            return search(action, args)
        case "close_dialog":
            // The merge tool or its conflicts list answers for itself (an edited merge refuses, as in the app);
            // otherwise Settings and the search popups each close their own, like Escape, and the answer has both.
            if onMain({ MergeCenter.shared.mergePath != nil || MergeCenter.shared.conflictsOpen }) {
                return merge(action, args)
            }
            _ = search(action, args)
            _ = settings(action, args)
            return reply(ok: true, structured: onMain { popupState().merging(settingsState()) { popup, _ in popup } })
        case "open_conflicts", "open_merge", "merge":
            return merge(action, args)
        default:
            return ControlTerminal.answer(action, args) ?? reply(ok: false, text: "Unknown action: \(action)")
        }
    }

    /// Waits for the walk on the server's thread; the walk itself runs on the main thread's timer.
    private static func scroll(speed: Double, rounds: Int) -> String {
        let semaphore = DispatchSemaphore(value: 0)
        var walked: ScrollWalk.Result?
        let started = onMain { () -> Bool in
            guard let window = mainWindow() else {
                return false
            }
            return ScrollWalk.start(in: window, speed: max(5, speed), rounds: max(1, rounds)) { result in
                walked = result
                semaphore.signal()
            }
        }
        guard started else {
            return reply(ok: false, text: "Nothing on screen can scroll")
        }
        semaphore.wait()
        let result = onMain { walked }
        return reply(ok: true, structured: [
            "durationMs": result?.durationMs ?? 0,
            "frames": result?.frames ?? 0,
            "slowFrames": result?.slowFrames ?? 0,
            "scrollHeight": result?.scrollHeight ?? 0,
            "clientHeight": result?.clientHeight ?? 0,
            "frameMs": result?.frameMs ?? [:],
            "draw": result?.draw ?? [:],
        ])
    }

    @MainActor
    static func state() -> [String: Any] {
        let model = AppModel.shared
        let status = model.snapshot?.status
        var state: [String: Any] = [
            "repoPath": orNull(model.repoPath),
            "loading": model.loading,
            "error": orNull(model.errorText),
            "branch": orNull(status?.head.branch),
            "changedFiles": status?.files.count ?? 0,
            "files": status?.files.map(\.path) ?? [],
            "collapseUnchanged": DiffPrefs.shared.collapseUnchanged,
        ]
        state.merge(changesState()) { _, changes in changes }
        state["editor"] = editorState()
        state.merge(settingsState()) { _, settings in settings }
        state["merge"] = mergeState()
        state["workspace"] = workspaceState()
        if let window = mainWindow() {
            let content = window.contentLayoutRect.size
            state["window"] = [
                "x": window.frame.minX,
                "y": window.frame.minY,
                "width": window.frame.width,
                "height": window.frame.height,
                "colorSpace": orNull(window.colorSpace?.localizedName),
                "contentWidth": content.width,
                "contentHeight": content.height,
                "scale": window.backingScaleFactor,
            ]
        }
        return state
    }

    @MainActor
    private static func mainWindow() -> NSWindow? {
        NSApp.windows.first { $0.isVisible && !($0 is NSPanel) && $0.contentView != nil && $0.frame.height > 100 }
    }

    /// The window as the window server draws it, without its shadow (like `screencapture -o -l`),
    /// even when covered. An app may always capture its own windows, so this needs no Screen
    /// Recording permission.
    private static func capture(windowNumber: Int) -> Data? {
        guard let image = CGWindowListCreateImage(
            .null,
            .optionIncludingWindow,
            CGWindowID(windowNumber),
            [.boundsIgnoreFraming, .bestResolution]
        ) else {
            return nil
        }
        return NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
    }

    /// JSONSerialization cannot write a Swift nil; JSON null is NSNull.
    static func orNull(_ value: Any?) -> Any {
        value ?? NSNull()
    }

    static func onMain<Value>(_ work: @MainActor () -> Value) -> Value {
        DispatchQueue.main.sync {
            MainActor.assumeIsolated(work)
        }
    }

    static func reply(ok: Bool, text: String = "", structured: [String: Any] = [:]) -> String {
        let body: [String: Any] = ["ok": ok, "text": text, "structured": structured]
        guard let data = try? JSONSerialization.data(withJSONObject: body) else {
            return "{\"ok\":false,\"text\":\"Could not encode the answer\"}"
        }
        return String(decoding: data, as: UTF8.self)
    }
}
