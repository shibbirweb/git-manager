// Diff view preferences shared by every diff, like src/lib/diff/prefs.svelte.ts: "Collapse unchanged", on by
// default. The current app keeps them in localStorage; this app in ~/.gitmanager-native/diff.json, with the same
// shape ({"collapseUnchanged": true}), beside the control server's files and never in the real ~/.gitmanager.

import Foundation

@MainActor
final class DiffPrefs: ObservableObject {
    static let shared = DiffPrefs()

    @Published private(set) var collapseUnchanged: Bool
    /// False when the file is there but unreadable: the choice then stays in memory, so a broken file is never
    /// overwritten with defaults.
    private let writable: Bool

    private struct Stored: Codable {
        var collapseUnchanged: Bool?
    }

    /// $HOME as the process sees it, so a run with a throwaway HOME (gm-measure) reads its own file.
    static var fileURL: URL {
        let home = ProcessInfo.processInfo.environment["HOME"].flatMap { $0.isEmpty ? nil : $0 } ?? NSHomeDirectory()
        return URL(fileURLWithPath: home).appendingPathComponent(".gitmanager-native/diff.json")
    }

    private init() {
        guard let data = try? Data(contentsOf: Self.fileURL) else {
            collapseUnchanged = true
            writable = true
            return
        }
        let stored = try? JSONDecoder().decode(Stored.self, from: data)
        collapseUnchanged = stored?.collapseUnchanged ?? true
        writable = stored != nil
    }

    func toggleCollapse() {
        collapseUnchanged.toggle()
        guard writable, let data = try? JSONEncoder().encode(Stored(collapseUnchanged: collapseUnchanged)) else {
            return
        }
        let url = Self.fileURL
        do {
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(), withIntermediateDirectories: true
            )
            try data.write(to: url, options: .atomic)
        } catch {
            // Storage unavailable: keep the in-memory value only, as the current app does.
        }
    }
}
