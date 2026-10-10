// Git Manager Native: the SwiftUI experiment's app. Windows the size of the current app's default window, each
// with its own folders, over the shared Rust backend.

import AppKit
import SwiftUI

@main
struct GitManagerNativeApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        // The current app's CSS turns font smoothing off (-webkit-font-smoothing: antialiased): thinner strokes than
        // macOS draws by default. The same switch for this app, before any text is drawn.
        UserDefaults.standard.set(0, forKey: "AppleFontSmoothing")
    }

    var body: some Scene {
        // A window per WindowRequest (WindowOpener); the one macOS opens at start has none (WindowRoot).
        WindowGroup("Git Manager Native", id: "main", for: WindowRequest.self) { $request in
            WindowRoot(request: request)
        }
        .commands {
            // File > New Window (menuSpec.ts file.newWindow), in place of SwiftUI's own.
            CommandGroup(replacing: .newItem) {
                Button("New Window") {
                    WindowOpener.openNew(from: WindowContext.focused)
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            }
            // Git > GitHub (menuSpec.ts): the items that need an account so far.
            CommandMenu("Git") {
                Menu("GitHub") {
                    Button("Share Project on GitHub...") {
                        Task { await WindowContext.focused.github.shareProject() }
                    }
                    Button("Sync Fork") {
                        Task { await WindowContext.focused.github.syncFork() }
                    }
                    Button("Create Gist...") {
                        Task { await WindowContext.focused.github.createGist() }
                    }
                }
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    /// `GitManagerNative -folder /path/to/repo` opens that folder at start. A bare path would not do:
    /// AppKit takes it for a document to open and then skips the app's first window.
    /// `-folders '("/a", "/b")'` (a property list array, as macOS parses arguments) opens a workspace of several
    /// folders. `-workspaceFile /path/team.gitmanager-workspace` opens a workspace file instead.
    static func launchFolders() -> [String] {
        if let folders = UserDefaults.standard.stringArray(forKey: "folders"), !folders.isEmpty {
            return folders
        }
        return UserDefaults.standard.string(forKey: "folder").map { [$0] } ?? []
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // HOME=~/.gitmanager-native git-manager cli ... drives and measures this app (Control.swift).
        Control.start()
        AppearanceOption.apply()
        // Started as a bare binary (swift run), the app is not in the Dock and its window stays behind the terminal.
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        TerminalShortcut.install()
        // What the first diff would otherwise do on the main thread: JavaScriptCore's start and the code fonts
        // (about 35 ms each the first time).
        SyntaxHighlighter.shared.warmUp()
        CursorGuard.install()
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 1) {
            _ = CodeLineText.advance
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Every window stays in the session (Cmd+Q closes them all at once).
        WindowSessionKeeper.quit()
        // Quitting stops every terminal, so no shell is left behind.
        TerminalStore.shutdown()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
