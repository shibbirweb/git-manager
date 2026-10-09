// Settings > Automation (SettingsDialog.svelte's automation section): the MCP server switch, its status with
// Available MCP Tools..., the port, and once there is a token the token with Show, Copy and New Token and the two
// ways to connect a client; then the command line tool switch, how to reach it and examples; then the memory log.
// The native app has no command line tool of its own: the current app's reaches it through its home folder.

import AppKit
import NativeCore
import SwiftUI

@MainActor
enum AutomationRows {
    static func items() -> [CatalogItem] {
        let server = McpServerStore.shared
        var items: [CatalogItem] = [
            .group("MCP server"),
            .toggle("MCP server", "MCP (Model Context Protocol) lets AI tools such as Claude Code or Cursor use Git "
                + "Manager: read what it shows, run its features and measure its performance. Off by default. When "
                + "on, it only listens on this Mac and every request needs the secret token below.",
                key: McpServerStore.mcpKey, on: false),
            .custom("Status", AnyView(SettingsRow(
                "Status", hintRuns: [TextRun(text: server.statusLine, token: server.statusFailed ? "--danger" : nil)],
                control: smallButton("Available MCP Tools...") {
                    WindowContext.focused.toasts.show(.info, "Not in the native app yet",
                                                      detail: "Available MCP Tools")
                }
            ))),
            .custom("Port", AnyView(SettingsRow(
                "Port", hintRuns: [server.portError.map { TextRun(text: $0, token: "--danger") }
                    ?? TextRun(text: "On 127.0.0.1, shared with the command line tool. A change restarts the server.")],
                control: .view(AnyView(McpPortField(port: server.port)), width: 110)
            ))),
        ]
        if let token = server.status?.token {
            let shown = server.showToken ? token : McpConnect.maskToken(token)
            items += [
                .custom("Secret token", AnyView(SettingsRow(
                    "Secret token", hint: "Connected tools send it with every request. Keep it private.",
                    below: AnyView(McpTokenLine(shown: shown, token: token))
                ))),
                .custom("Connect Claude Code", AnyView(SettingsRow(
                    "Connect Claude Code", hint: "Run this once in a terminal.",
                    below: AnyView(McpSnippet(text: McpConnect.claudeAddCommand(url: server.url, token: shown),
                                              copied: McpConnect.claudeAddCommand(url: server.url, token: token)))
                ))),
                .custom("Other MCP clients", AnyView(SettingsRow(
                    "Other MCP clients", hint: "Most MCP clients read a config like this one.",
                    below: AnyView(McpSnippet(text: McpConnect.jsonConfig(url: server.url, token: shown),
                                              copied: McpConnect.jsonConfig(url: server.url, token: token)))
                ))),
            ]
        } else if server.wanted {
            items.append(.custom("Secret token", AnyView(SettingsRow(
                "Secret token", hint: "Made when the server first starts."
            ))))
        }
        items += [
            .group("Command line tool"),
            .toggle("Command line tool", "Lets scripts and AI agents in a terminal use the same tools, for example "
                + "git-manager cli tools or git-manager cli call git_status repoPath=.... Git Manager must be "
                + "running.", key: McpServerStore.cliKey, on: false),
        ]
        if server.status != nil {
            items += [
                .custom("Install", AnyView(SettingsRow(
                    "Install", hint: "The native app uses the current app's command line tool, with its home "
                        + "folder set to ~/.gitmanager-native."
                ))),
                .custom("Examples", AnyView(SettingsRow(
                    "Examples", hint: "The tool switches in Help > Available MCP Tools apply here too.",
                    below: AnyView(McpExamples(examples: McpConnect.examples(prefix: McpServerStore.cliPrefix)))
                ))),
            ]
        }
        items += [
            .group("Memory log"),
            .toggle("Log memory changes", "For finding what uses memory: writes a line whenever the app's memory "
                + "changes.", key: "memoryLogEnabled", on: false),
        ]
        return items
    }

    /// A .btn.small as a row's control: its text's width, 8 points in and the border.
    static func smallButton(_ title: String, action: @escaping () -> Void) -> RowControl {
        let width = ExactText.width(title, font: PageFont.ui(12)) + 18
        return .view(AnyView(DialogButton(title: title, hug: true, small: true, action: action)), width: width)
    }

    static func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        WindowContext.focused.toasts.show(.success, "Copied")
    }
}

/// .number-input: 110 wide, the code font at 12 points; Return takes the port when it is a whole number in range.
private struct McpPortField: View {
    let port: Int

    @State private var draft = ""
    @State private var focused = false

    var body: some View {
        PageInput(text: $draft, focused: focused, mono: true, onFocus: { focused = true }, onSubmit: apply,
                  fontSize: 12)
            .frame(width: 110)
            .onAppear {
                draft = String(port)
            }
            .onChange(of: port) { next in
                draft = String(next)
            }
    }

    private func apply() {
        let store = McpServerStore.shared
        guard let next = McpConnect.parsePort(draft) else {
            store.portError = "Use a whole number from \(McpConnect.portRange.lowerBound) to "
                + "\(McpConnect.portRange.upperBound)."
            return
        }
        store.portError = nil
        draft = String(next)
        store.setPort(next)
    }
}

/// .path-row: the token (or its dots) in a --panel-alt code box, then Show, Copy and New Token, 10 apart.
private struct McpTokenLine: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var server = McpServerStore.shared

    let shown: String
    let token: String

    var body: some View {
        HStack(spacing: 10) {
            Text(shown)
                .font(Font(CodeFonts(size: 12).regular))
                .foregroundStyle(theme.ink("--text"))
                .lineLimit(1)
                .textSelection(.enabled)
                .padding(.vertical, 4)
                .padding(.horizontal, 8)
                .background(RoundedRectangle(cornerRadius: 5, style: .circular).fill(theme.color("--panel-alt")))
            DialogButton(title: server.showToken ? "Hide" : "Show", hug: true, small: true) {
                server.showToken.toggle()
            }
            DialogButton(title: "Copy", hug: true, small: true) {
                AutomationRows.copy(token)
            }
            DialogButton(title: "New Token", disabled: server.working, hug: true, small: true, danger: true) {
                server.regenerateToken()
            }
            Spacer(minLength: 0)
        }
    }
}

/// .snippet: the text in a --panel-alt .command box (the code font at 11.5, wrapping anywhere), Copy beside it.
private struct McpSnippet: View {
    let text: String
    let copied: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            McpCommandBox(text: text)
            DialogButton(title: "Copy", hug: true, small: true) {
                AutomationRows.copy(copied)
            }
        }
    }
}

private struct McpCommandBox: View {
    @Environment(\.theme) private var theme
    @Environment(\.settingsRowsWidth) private var rowsWidth

    let text: String

    var body: some View {
        let font = CodeFonts(size: 11.5).regular
        // The row less Copy, the 8 between and the box's 8 points of padding on each side.
        let width = rowsWidth - (ExactText.width("Copy", font: PageFont.ui(12)) + 18) - 8 - 16
        let lines = TextWrap.preWrapLines(text, width: width) { piece in
            Double((piece as NSString).size(withAttributes: [.font: font]).width)
        }
        Text(lines.joined(separator: "\n"))
            .font(Font(font))
            .foregroundStyle(theme.ink("--text"))
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.vertical, 6)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 5, style: .circular).fill(theme.color("--panel-alt")))
    }
}

/// The examples: each command over its hint (.example, 2 apart), Copy beside it.
private struct McpExamples: View {
    @Environment(\.theme) private var theme

    let examples: [McpConnect.Example]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(examples, id: \.command) { example in
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        McpCommandBox(text: example.command)
                        Text(example.hint)
                            .font(PageFont.font(12))
                            .foregroundStyle(theme.ink("--text-dim"))
                    }
                    DialogButton(title: "Copy", hug: true, small: true) {
                        AutomationRows.copy(example.command)
                    }
                }
            }
        }
    }
}
