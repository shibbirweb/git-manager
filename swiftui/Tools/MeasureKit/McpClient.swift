// A small MCP client for either app: reads the server file (port and token) and calls tools over
// JSON-RPC, like `git-manager cli` does.

import Foundation

public struct ServerFile: Decodable {
    public let token: String
    public let port: Int?
    public let pid: Int32?

    public static func read(path filePath: String) -> ServerFile? {
        guard let data = FileManager.default.contents(atPath: filePath) else {
            return nil
        }
        return try? JSONDecoder().decode(ServerFile.self, from: data)
    }
}

public struct ToolAnswer {
    public let isError: Bool
    public let text: String
    public let structured: [String: Any]?
    /// The PNG of a tool that returns an image.
    public let image: Data?
}

public final class McpClient {
    public let port: Int
    private let token: String

    public init(port: Int, token: String) {
        self.port = port
        self.token = token
    }

    public func request(_ method: String, _ params: [String: Any] = [:], timeout: TimeInterval = 90) async throws -> [String: Any] {
        guard let url = URL(string: "http://127.0.0.1:\(port)/mcp") else {
            throw ToolError("Bad port \(port)")
        }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json, text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("cli", forHTTPHeaderField: "x-git-manager-client")
        let message: [String: Any] = ["jsonrpc": "2.0", "id": 1, "method": method, "params": params]
        request.httpBody = try JSONSerialization.data(withJSONObject: message)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let reply = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        if let error = reply?["error"] {
            let text = (error as? [String: Any])?["message"] as? String ?? (error as? String) ?? "error"
            throw ToolError("\(method): \(text)")
        }
        guard status == 200, let reply else {
            throw ToolError("\(method): HTTP \(status)")
        }
        return reply["result"] as? [String: Any] ?? [:]
    }

    public func initialize() async throws {
        _ = try await request("initialize", [
            "protocolVersion": "2025-06-18",
            "capabilities": [String: Any](),
            "clientInfo": ["name": "gm-measure", "version": "0.1.0"],
        ])
    }

    public func listTools() async throws -> [String] {
        let result = try await request("tools/list")
        let tools = result["tools"] as? [[String: Any]] ?? []
        return tools.compactMap { $0["name"] as? String }
    }

    public func call(_ toolName: String, _ args: [String: Any] = [:], timeout: TimeInterval = 90) async throws -> ToolAnswer {
        let result = try await request("tools/call", ["name": toolName, "arguments": args], timeout: timeout)
        let content = result["content"] as? [[String: Any]] ?? []
        let text = content.filter { $0["type"] as? String == "text" }.compactMap { $0["text"] as? String }.joined(separator: "\n")
        let image = content.first { $0["type"] as? String == "image" }
            .flatMap { $0["data"] as? String }
            .flatMap { Data(base64Encoded: $0) }
        return ToolAnswer(
            isError: result["isError"] as? Bool ?? false,
            text: text,
            structured: result["structuredContent"] as? [String: Any],
            image: image
        )
    }
}
