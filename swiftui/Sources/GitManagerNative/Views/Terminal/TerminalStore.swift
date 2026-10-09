// The bottom panel and its terminal (src/lib/terminal/terminalStore.svelte.ts, one terminal for now): shown and
// hidden by the Terminal activity item, Ctrl+` and the control server. Hiding keeps the shell running; a shell that
// exits cleanly closes its terminal, one that fails stays with its exit note, as in the current app.

import AppKit
import Foundation
import NativeCore

@MainActor
final class TerminalStore: ObservableObject {
    static let shared = TerminalStore()

    @Published private(set) var panelOpen = false
    @Published private(set) var session: TerminalSession?
    /// Keyboard focus on the terminal: the cursor is a filled block, else an outline.
    @Published var focused = false
    /// Asks the canvas to take the keyboard focus (a new terminal, the panel shown by the user).
    @Published private(set) var focusRequests = 0
    private var nextKey = 1

    /// The default panel height (settingsData.ts DEFAULT_TERMINAL_HEIGHT), border included.
    static let panelHeight: CGFloat = 260

    func toggle() {
        if panelOpen {
            hide()
        } else {
            show()
        }
    }

    func show(focus: Bool = true) {
        panelOpen = true
        if focus {
            focusRequests += 1
        }
    }

    func hide() {
        panelOpen = false
        focused = false
    }

    /// The canvas knows the grid size once it is laid out: the first one starts the shell, later ones resize it.
    func layout(columns: Int, rows: Int) {
        if let session {
            session.resize(columns: columns, rows: rows)
            return
        }
        create(columns: columns, rows: rows)
    }

    /// A new terminal in the active repository (else the home folder), like New Terminal.
    @discardableResult
    func create(columns: Int = 80, rows: Int = 24) -> TerminalSession {
        session?.close()
        let created = TerminalSession(key: nextKey, columns: columns, rows: rows)
        nextKey += 1
        created.onExit = { [weak self] ended in
            // A clean exit closes the terminal; an error leaves it with its note.
            if ended.exitCode == 0, self?.session === ended {
                self?.session = nil
                self?.hide()
            }
        }
        session = created
        created.start(cwd: AppModel.shared.repoPath)
        return created
    }

    /// Kill Terminal: the shell goes at once and the panel closes with its last terminal.
    func kill() {
        session?.close()
        session = nil
        hide()
    }

    /// At quit: hangs up every shell so none is left behind.
    nonisolated static func shutdown() {
        try? Backend.perform("terminal_shutdown", [String: String]())
    }
}

extension Theme {
    /// The --term-* tokens as xterm.js's theme (src/lib/terminal/theme.ts THEME_TOKENS).
    var terminalPalette: TermPalette {
        let names = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]
        let ansi = names.map { rgb("--term-\($0)") } + names.map { rgb("--term-bright-\($0)") }
        return TermPalette(
            background: rgb("--term-background"), foreground: rgb("--term-foreground"), cursor: rgb("--term-cursor"),
            selection: rgb("--term-selection"), ansi16: ansi
        )
    }

    /// A #rrggbb token as 0xRRGGBB (0 when missing), as xterm.js reads the CSS tokens.
    func rgb(_ tokenName: String) -> UInt32 {
        let tokens = Themes.all.first { $0.id == id }?.colors ?? [:]
        let text = (tokens[tokenName] ?? "").trimmingCharacters(in: .whitespaces)
        guard text.hasPrefix("#"), text.count == 7, let value = UInt32(text.dropFirst(), radix: 16) else {
            return 0
        }
        return value
    }
}
