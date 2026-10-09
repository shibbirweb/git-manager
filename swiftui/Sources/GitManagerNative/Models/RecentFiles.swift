// What Quick Open lists as recently opened, and the Command Palette's recently used commands (the current app keeps
// both in state.json: src/lib/recentFiles, settings.recentCommands). The native app has no file tabs yet (the file
// view is GM-52), so files come in through `opened`, which the control server's quick_open calls for files the
// scenario opened in the current app; they also give the header's Back button a place to go, as there.

import Foundation

@MainActor
final class RecentFiles: ObservableObject {
    static let shared = RecentFiles()

    /// Absolute paths, most recent first.
    @Published private(set) var filePaths: [String] = []
    /// Command ids, most recent first (at most 20, like MAX_RECENT_COMMANDS).
    @Published private(set) var commandIds: [String] = []
    /// Files were opened, so navigation history has somewhere to go back to.
    @Published private(set) var canGoBack = false

    /// A file was opened in the editor: it moves to the top (at most 50, like RECENT_LIMIT).
    func opened(_ filePath: String) {
        filePaths = Array(([filePath] + filePaths.filter { $0 != filePath }).prefix(50))
        canGoBack = filePaths.count > 1
    }

    func ranCommand(_ commandId: String) {
        commandIds = Array(([commandId] + commandIds.filter { $0 != commandId }).prefix(20))
    }
}
