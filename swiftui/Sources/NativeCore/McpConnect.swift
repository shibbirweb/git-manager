// Settings > Automation's pure parts (settingsData.ts parseMcpPort and src/lib/mcp/connect.ts): the port rule, the
// Claude Code command, the JSON config for other MCP clients, the masked token and the command line examples.

import Foundation

public enum McpConnect {
    public static let serverName = "git-manager"
    public static let defaultPort = 48731
    public static let portRange = 1024...65535

    /// A whole number in the port range (a number, or text holding one), else nil.
    public static func parsePort(_ value: Any?) -> Int? {
        var number: Double?
        if let text = value as? String, !text.trimmingCharacters(in: .whitespaces).isEmpty {
            number = Double(text.trimmingCharacters(in: .whitespaces))
        } else if let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID() {
            number = value.doubleValue
        }
        guard let number, number.isFinite, number.rounded() == number else {
            return nil
        }
        let port = Int(number)
        return portRange.contains(port) ? port : nil
    }

    public static func claudeAddCommand(url: String, token: String) -> String {
        "claude mcp add --transport http \(serverName) \(url) --header \"Authorization: Bearer \(token)\""
    }

    /// The `mcpServers` block most clients read, laid out as JSON.stringify(config, null, 2) does.
    public static func jsonConfig(url: String, token: String) -> String {
        [
            "{",
            "  \"mcpServers\": {",
            "    \"\(serverName)\": {",
            "      \"type\": \"http\",",
            "      \"url\": \(quoted(url)),",
            "      \"headers\": {",
            "        \"Authorization\": \(quoted("Bearer \(token)"))",
            "      }",
            "    }",
            "  }",
            "}",
        ].joined(separator: "\n")
    }

    /// Dots instead of the token, at most 24.
    public static func maskToken(_ token: String) -> String {
        String(repeating: "\u{2022}", count: min(token.count, 24))
    }

    public struct Example: Equatable {
        public let command: String
        public let hint: String
    }

    public static func examples(prefix: String) -> [Example] {
        [
            Example(command: "\(prefix) status", hint: "Is the app running and the server on?"),
            Example(command: "\(prefix) tools", hint: "Every tool that is on, with its arguments."),
            Example(command: "\(prefix) call get_app_state", hint: "Call one tool; arguments go as name=value."),
            Example(command: "\(prefix) screenshot ~/Desktop/gm.png", hint: "Save a picture of the window."),
        ]
    }

    private static func quoted(_ text: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [text], options: [.withoutEscapingSlashes])) ?? Data()
        let array = String(decoding: data, as: UTF8.self)
        return String(array.dropFirst().dropLast())
    }
}
