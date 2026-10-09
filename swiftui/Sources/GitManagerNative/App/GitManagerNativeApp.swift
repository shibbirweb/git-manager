// Git Manager Native: phase 0 of the SwiftUI experiment. One window, the size of the current
// app's default window, that opens a folder and shows its git status from the shared Rust backend.

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
        Window("Git Manager Native", id: "main") {
            Group {
                // Started by git mergetool with its four files: the merge tool alone (MergeToolApp.svelte).
                if MergeCenter.shared.mergetool != nil {
                    MergetoolRoot()
                } else {
                    ContentView(initialFolders: AppDelegate.launchFolders(),
                                initialWorkspaceFile: UserDefaults.standard.string(forKey: "workspaceFile"))
                }
            }
                .frame(minWidth: 960, minHeight: 600)
                .background(WindowSizer())
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
        // Quitting stops every terminal, so no shell is left behind.
        TerminalStore.shutdown()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
