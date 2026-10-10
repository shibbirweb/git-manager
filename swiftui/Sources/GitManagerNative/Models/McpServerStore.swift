// Settings > Automation's server (src/lib/mcp/mcpStore.svelte.ts): applies the MCP server and command line tool
// switches and the port from settings.json to the bridge's server (`mcp_configure`), keeps its status for the page,
// and makes a new token. Applies run one after another off the main thread (stopping waits for the listener).

import AppKit
import NativeCore

struct McpStatusDTO: Decodable, Equatable {
    let enabled: Bool
    let cliEnabled: Bool
    let running: Bool
    let port: Int
    let url: String
    let token: String?
    let error: String?
}

private struct McpSwitches: Encodable {
    let enabled: Bool
    let cliEnabled: Bool
    let port: Int
}

@MainActor
final class McpServerStore: ObservableObject {
    static let shared = McpServerStore()

    static let mcpKey = "mcpEnabled"
    static let cliKey = "cliEnabled"
    static let portKey = "mcpPort"
    /// The native app has no command line tool of its own: the current app's reaches it through its home folder.
    static let cliPrefix = "HOME=~/.gitmanager-native git-manager cli"

    /// The Settings page reads these through its catalog, so a change redraws it.
    @Published private(set) var status: McpStatusDTO? {
        willSet {
            SettingsStore.shared.objectWillChange.send()
        }
    }
    @Published private(set) var working = false {
        willSet {
            SettingsStore.shared.objectWillChange.send()
        }
    }
    /// Settings > Automation shows the token while this is on (Show / Hide), for this run only.
    @Published var showToken = false {
        willSet {
            SettingsStore.shared.objectWillChange.send()
        }
    }
    /// Why the typed port was not taken; nil when it was.
    @Published var portError: String? {
        willSet {
            SettingsStore.shared.objectWillChange.send()
        }
    }
    private let queue = DispatchQueue(label: "mcp-configure")

    private var settings: SettingsStore {
        SettingsStore.shared
    }

    var mcpEnabled: Bool {
        settings.storedBool(Self.mcpKey, default: false)
    }

    var cliEnabled: Bool {
        settings.storedBool(Self.cliKey, default: false)
    }

    var port: Int {
        McpConnect.parsePort(settings.storedValue(Self.portKey)) ?? McpConnect.defaultPort
    }

    /// Either switch is on: the server should run.
    var wanted: Bool {
        mcpEnabled || cliEnabled
    }

    /// Starts, restarts or stops the server to match settings.json.
    func apply() {
        let switches = McpSwitches(enabled: mcpEnabled, cliEnabled: cliEnabled, port: port)
        queue.async {
            let next = try? Backend.call("mcp_configure", switches) as McpStatusDTO
            DispatchQueue.main.async {
                McpServerStore.shared.status = next
            }
        }
    }

    func setSwitch(_ key: String, _ isOn: Bool) {
        settings.setStoredBool(key, isOn)
        apply()
    }

    func setPort(_ port: Int) {
        guard port != self.port else {
            return
        }
        settings.setStoredInt(Self.portKey, port)
        apply()
    }

    /// New Token: tools connected with the old one must be set up again.
    func regenerateToken() {
        working = true
        queue.async {
            let result = Result { try Backend.call("mcp_regenerate_token", [String: String]()) as McpStatusDTO }
            DispatchQueue.main.async {
                let store = McpServerStore.shared
                store.working = false
                switch result {
                case .success(let next):
                    store.status = next
                case .failure(let error):
                    WindowContext.focused.toasts.show(.error, "Could not make a new token",
                                                      detail: AppModel.describe(error))
                }
            }
        }
    }

    /// The Status row's line: where it runs, why it does not, or Off.
    var statusLine: String {
        guard let status else {
            return wanted ? "Starting..." : "Off"
        }
        if let error = status.error {
            return error
        }
        return status.running ? "Running at \(status.url)" : "Off"
    }

    var statusFailed: Bool {
        status?.error != nil
    }

    var url: String {
        status?.url.isEmpty == false ? status?.url ?? "" : "http://127.0.0.1:\(port)/mcp"
    }
}
