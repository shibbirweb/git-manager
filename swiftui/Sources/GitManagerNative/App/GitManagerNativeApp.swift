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
            ContentView(initialRepoPath: AppDelegate.launchFolder())
                .frame(minWidth: 960, minHeight: 600)
                .background(WindowSizer())
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    /// `GitManagerNative -folder /path/to/repo` opens that folder at start. A bare path would not do:
    /// AppKit takes it for a document to open and then skips the app's first window.
    static func launchFolder() -> String? {
        UserDefaults.standard.string(forKey: "folder")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // HOME=~/.gitmanager-native git-manager cli ... drives and measures this app (Control.swift).
        Control.start()
        AppearanceOption.apply()
        // Started as a bare binary (swift run), the app is not in the Dock and its window stays behind the terminal.
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        TerminalShortcut.install()
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Quitting stops every terminal, so no shell is left behind.
        TerminalStore.shutdown()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
