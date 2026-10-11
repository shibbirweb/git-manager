// gm-measure --screen completion: src/cart.ts open in both apps, the cursor moved to the end of line 57 (inside the
// total() method) with Go to Line and Cmd+Right, a new line, then "th" typed: the completion popup with the
// language's keywords and the words nearby. completionvars types "dis": scope names with their letter badges.
// completionsnippet types "fo", Down (past the word "for" of a comment) and Return: the "for" loop inserted, its
// first field selected, the others tinted. The current app's popup boxes and styles go to completion-page.json
// next to the screenshots, as the layout to match.

import Foundation
import MeasureKit

extension Measure {
    static let completionScreens = ["completion", "completionvars", "completionsnippet"]
    static let completionFile = "src/cart.ts"
    static let completionLine = 57
    static let pageStyles = [
        "width", "height", "left", "top", "font-size", "line-height", "padding", "margin", "font-family", "font-weight",
        "color", "background-color", "border", "border-radius", "box-shadow", "vertical-align", "max-height",
        "position", "transform", "white-space", "letter-spacing",
    ]

    static func showCompletion(_ app: RunningApp, outDir: String, screen: String) async throws {
        let typed = ["completionvars": "dis", "completionsnippet": "fo"][screen] ?? "th"
        try await openFile(app, filePath: completionFile)
        try await Task.sleep(nanoseconds: 1_000_000_000)
        WindowCapture.bringToFront(pid: app.pid)
        // L with Cmd: Go to Line, then the line number and Return.
        KeyPoster.press(pid: app.pid, keyCode: 37, flags: .maskCommand)
        try await waitForPrompt(app)
        KeyPoster.type(pid: app.pid, "\(completionLine)")
        KeyPoster.press(pid: app.pid, keyCode: 36)
        try await Task.sleep(nanoseconds: 400_000_000)
        // Right arrow with Cmd (the line's end), then Return for a new indented line.
        KeyPoster.press(pid: app.pid, keyCode: 124, flags: .maskCommand)
        KeyPoster.press(pid: app.pid, keyCode: 36)
        try await Task.sleep(nanoseconds: 300_000_000)
        KeyPoster.type(pid: app.pid, typed)
        try await Task.sleep(nanoseconds: 800_000_000)
        if screen == "completionsnippet" {
            if app.kind == .current {
                let found = try await app.client.call("inspect_elements", [
                    "selector": ".cm-tooltip-autocomplete li", "limit": 20,
                ])
                let path = (outDir as NSString).appendingPathComponent("completion-before.json")
                try Data(found.text.utf8).write(to: URL(fileURLWithPath: path))
            }
            // Down arrow, then Return.
            KeyPoster.press(pid: app.pid, keyCode: 125)
            try await Task.sleep(nanoseconds: 300_000_000)
            KeyPoster.press(pid: app.pid, keyCode: 36)
            try await Task.sleep(nanoseconds: 800_000_000)
        }
        if app.kind == .current {
            let selector = screen == "completionsnippet"
                ? ".cm-snippetField, .cm-snippetFieldPosition, .cm-activeLine, .cm-selectionBackground"
                : ".cm-tooltip-autocomplete, .cm-tooltip-autocomplete *, .cm-cursor, .cm-content"
            let found = try await app.client.call("inspect_elements", [
                "selector": selector, "limit": 100, "styles": pageStyles,
            ])
            let path = (outDir as NSString).appendingPathComponent("completion-page.json")
            try Data(found.text.utf8).write(to: URL(fileURLWithPath: path))
            print("current: the popup's layout is in \(path)")
        }
    }

    /// Waits until the Go to Line prompt has the keyboard (up to 5 s), so the line number goes into it.
    static func waitForPrompt(_ app: RunningApp) async throws {
        let start = Date()
        while Date().timeIntervalSince(start) < 5 {
            try await Task.sleep(nanoseconds: 100_000_000)
            if app.kind == .native {
                let state = try await app.client.call("app", ["action": "get_state"]).structured ?? [:]
                let window = state["window"] as? [String: Any]
                if window?["firstResponder"] as? String == "FastFieldEditor" {
                    break
                }
            } else {
                let found = try await app.client.call("inspect_elements", ["selector": ".dialog input", "limit": 1])
                if (found.structured?["count"] as? Int ?? 0) > 0 {
                    break
                }
            }
        }
        print("\(app.kind.rawValue): the prompt took \(Int(Date().timeIntervalSince(start) * 1000)) ms")
        try await Task.sleep(nanoseconds: 300_000_000)
    }
}
