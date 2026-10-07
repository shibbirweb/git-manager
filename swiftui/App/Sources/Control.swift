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
        case "open_folder":
            guard let folderPath = args["folderPath"] as? String, !folderPath.isEmpty else {
                return reply(ok: false, text: "folderPath is required")
            }
            onMain { AppModel.shared.begin(folderPath) }
            let result = AppModel.readStatus(repoPath: folderPath)
            onMain { AppModel.shared.finish(result) }
            if case .failure(let error) = result {
                return reply(ok: false, text: error.message, structured: onMain { state() })
            }
            return reply(ok: true, structured: onMain { state() })
        default:
            return reply(ok: false, text: "Unknown action: \(action)")
        }
    }

    @MainActor
    private static func state() -> [String: Any] {
        let model = AppModel.shared
        let status = model.snapshot?.status
        var state: [String: Any] = [
            "repoPath": orNull(model.repoPath),
            "loading": model.loading,
            "error": orNull(model.errorText),
            "branch": orNull(status?.head.branch),
            "changedFiles": status?.files.count ?? 0,
            "files": status?.files.map(\.path) ?? [],
        ]
        if let window = mainWindow() {
            let content = window.contentLayoutRect.size
            state["window"] = [
                "width": window.frame.width,
                "height": window.frame.height,
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
    private static func orNull(_ value: Any?) -> Any {
        value ?? NSNull()
    }

    private static func onMain<Value>(_ work: @MainActor () -> Value) -> Value {
        DispatchQueue.main.sync {
            MainActor.assumeIsolated(work)
        }
    }

    private static func reply(ok: Bool, text: String = "", structured: [String: Any] = [:]) -> String {
        let body: [String: Any] = ["ok": ok, "text": text, "structured": structured]
        guard let data = try? JSONSerialization.data(withJSONObject: body) else {
            return "{\"ok\":false,\"text\":\"Could not encode the answer\"}"
        }
        return String(decoding: data, as: UTF8.self)
    }
}
