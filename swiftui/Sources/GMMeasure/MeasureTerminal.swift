// gm-measure measure --screen terminal (and parity's showTerminal): both apps show the terminal panel with one shell
// whose output is fixed. Each app starts with its throwaway HOME, so the login shell (zsh) reads a .zshrc written
// there: a "$ " prompt, a few lines of plain, colored and styled text, and the cursor hidden (it blinks, so captures
// would differ by when they were taken). Then the panel is shown and the run waits until the prompt is on screen.

import Foundation
import MeasureKit

enum MeasureTerminal {
    /// The shell profile both apps' shells read. Kept in step with the cells measured in the native app's tests.
    static let shellProfile = #"""
        PS1='$ '
        RPS1=''
        unsetopt PROMPT_SP
        printf 'Git Manager terminal check\n'
        printf 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789\n'
        printf '!"#$%%&()*+,-./:;<=>?@[\\]^_`{|}~ fi fl -> => != <= >= ===\n'
        printf '\033[31mred\033[0m \033[32mgreen\033[0m \033[33myellow\033[0m '
        printf '\033[34mblue\033[0m \033[35mmagenta\033[0m \033[36mcyan\033[0m\n'
        printf '\033[1mbold text\033[0m \033[2mdim text\033[0m \033[3mitalic\033[0m '
        printf '\033[4munderline\033[0m \033[7minverse\033[0m\n'
        printf '\033[90mbright black\033[0m \033[91mbright red\033[0m '
        printf '\033[92mbright green\033[0m \033[94mbright blue\033[0m\n'
        printf '\033[?25l'

        """#

    /// Writes the profile into the app's HOME (zsh's .zshrc, bash's .bashrc), before the app starts.
    static func writeShellProfile(home: String) throws {
        try FileManager.default.createDirectory(atPath: home, withIntermediateDirectories: true)
        for name in [".zshrc", ".bashrc"] {
            let path = (home as NSString).appendingPathComponent(name)
            try shellProfile.write(toFile: path, atomically: true, encoding: .utf8)
        }
    }

    /// Shows the panel and waits until the shell runs and has printed its prompt.
    static func show(_ app: RunningApp) async throws {
        let shown = app.kind == .native
            ? try await app.client.call("app", ["action": "show_panel", "panel": "terminal"])
            : try await app.client.call("show_panel", ["panel": "terminal"])
        if shown.isError {
            throw ToolError("\(app.kind.rawValue): could not show the terminal: \(shown.text)")
        }
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            if try await ready(app) {
                return
            }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        throw ToolError("\(app.kind.rawValue): the terminal's shell did not start within 10 s")
    }

    /// The native app reads its screen; the current app only tells that its shell runs, so it gets a moment more
    /// for the shell to print (the settle time follows anyway).
    private static func ready(_ app: RunningApp) async throws -> Bool {
        if app.kind == .native {
            let screen = try await app.client.call("app", ["action": "terminal_text"]).structured ?? [:]
            let lines = screen["lines"] as? [String] ?? []
            return lines.contains("$")
        }
        let list = try await app.client.call("list_terminals").structured ?? [:]
        let terminals = list["terminals"] as? [[String: Any]] ?? []
        guard terminals.first?["running"] as? Bool == true else {
            return false
        }
        try await Task.sleep(nanoseconds: 1_000_000_000)
        return true
    }
}
