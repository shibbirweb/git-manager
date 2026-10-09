// The smoke test's terminal checks: show the panel (a shell starts with gm-measure's profile), type a command and see
// its output on the screen, then hide the panel with the shell still running.

import Foundation
import MeasureKit

enum SmokeTerminal {
    static func check(_ client: McpClient, check: (String, Bool, String) -> Void) async throws {
        let shown = try await client.call("app", ["action": "show_panel", "panel": "terminal"])
        let terminals = (shown.structured?["terminals"] as? [[String: Any]]) ?? []
        let started = terminals.first?["running"] as? Bool == true
        check("show_panel terminal", !shown.isError && started, shown.isError ? shown.text : "")
        let prompt = try await waitForLine(client) { $0 == "$" }
        check("the shell prints its prompt", prompt, "")
        let sent = try await client.call("app", ["action": "send_terminal_text", "text": "printf 'smoke-%s\\n' ok"])
        let output = try await waitForLine(client) { $0 == "smoke-ok" }
        check("send_terminal_text runs a command", !sent.isError && output, sent.isError ? sent.text : "")
        let hidden = try await client.call("app", ["action": "show_panel", "panel": "terminal", "visible": false])
        let list = try await client.call("app", ["action": "list_terminals"]).structured ?? [:]
        let open = (list["bottomPanel"] as? [String: Any])?["open"] as? Bool
        let running = ((list["terminals"] as? [[String: Any]])?.first?["running"] as? Bool) == true
        check("hiding the panel keeps the shell", !hidden.isError && open == false && running, "")
    }

    /// Waits up to 10 seconds for a screen line that matches.
    private static func waitForLine(_ client: McpClient, _ matches: (String) -> Bool) async throws -> Bool {
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            let screen = try await client.call("app", ["action": "terminal_text"]).structured ?? [:]
            if (screen["lines"] as? [String] ?? []).contains(where: matches) {
                return true
            }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        return false
    }
}
