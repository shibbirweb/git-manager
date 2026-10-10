import Foundation
import NativeCore
import Testing

struct McpConnectTests {
    @Test func portsFollowTheCurrentApp() {
        #expect(McpConnect.parsePort(50000) == 50000)
        #expect(McpConnect.parsePort("50000") == 50000)
        #expect(McpConnect.parsePort(" 4000 ") == 4000)
        #expect(McpConnect.parsePort(80) == nil)
        #expect(McpConnect.parsePort(70000) == nil)
        #expect(McpConnect.parsePort(5000.5) == nil)
        #expect(McpConnect.parsePort("") == nil)
        #expect(McpConnect.parsePort("port") == nil)
        #expect(McpConnect.parsePort(true) == nil)
        #expect(McpConnect.parsePort(nil) == nil)
    }

    @Test func snippetsMatchConnectTs() {
        let url = "http://127.0.0.1:48731/mcp"
        #expect(McpConnect.claudeAddCommand(url: url, token: "abc")
            == "claude mcp add --transport http git-manager http://127.0.0.1:48731/mcp "
            + "--header \"Authorization: Bearer abc\"")
        let config = McpConnect.jsonConfig(url: url, token: "abc")
        let parsed = try? JSONSerialization.jsonObject(with: Data(config.utf8)) as? [String: Any]
        let server = (parsed?["mcpServers"] as? [String: Any])?["git-manager"] as? [String: Any]
        #expect(server?["url"] as? String == url)
        #expect((server?["headers"] as? [String: String])?["Authorization"] == "Bearer abc")
        #expect(config.contains("\n      \"type\": \"http\",\n"))
        #expect(McpConnect.maskToken(String(repeating: "a", count: 64)).count == 24)
        #expect(McpConnect.maskToken("abc") == "\u{2022}\u{2022}\u{2022}")
        #expect(McpConnect.examples(prefix: "gm cli").first?.command == "gm cli status")
    }
}
