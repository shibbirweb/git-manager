// The recent projects, kept in ~/.gitmanager-native/state.json under the current app's state.json keys
// (recentFolders, recentWorkspaces, recentWorkspaceFiles): a folder opened alone or several opened together move
// to the top. It also keeps the window session ("windows", WindowSessionKeeper). Other keys in the file are kept; a
// file that could not be read is never written over.

import Foundation
import NativeCore

@MainActor
final class RecentProjectsStore: ObservableObject {
    static let shared = RecentProjectsStore()

    @Published private(set) var lists = RecentLists()
    /// Why state.json could not be read; nil when it was (or there is none yet).
    @Published private(set) var loadError: String?
    private var state: [String: Any] = [:]

    static var fileURL: URL {
        SettingsStore.fileURL.deletingLastPathComponent().appendingPathComponent("state.json")
    }

    private init() {
        guard let data = try? Data(contentsOf: Self.fileURL) else {
            return
        }
        guard let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            loadError = "state.json could not be read"
            return
        }
        state = object
        lists = RecentLists(state: object)
    }

    /// The workspace's folders were opened: from a workspace file, that file goes to the recent workspace files;
    /// else one folder to the recent folders, several to the recent workspaces.
    func opened(_ folderPaths: [String], file: String? = nil) {
        if let file {
            lists.addWorkspaceFile(file)
        } else if folderPaths.count == 1 {
            lists.addFolder(folderPaths[0])
        } else {
            lists.addWorkspace(folderPaths)
        }
        save()
    }

    /// The window session as state.json had it at start (WindowSessionKeeper).
    var savedSession: Any? {
        state[WindowSession.key]
    }

    func saveSession(_ entries: [WindowSession.Entry]) {
        state[WindowSession.key] = WindowSession.json(entries)
        save()
    }

    func remove(_ entry: RecentEntry) {
        lists.remove(entry)
        save()
    }

    private func save() {
        guard loadError == nil else {
            return
        }
        state.merge(lists.stateValues) { _, new in new }
        guard let data = try? JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys])
        else {
            return
        }
        try? FileManager.default.createDirectory(at: Self.fileURL.deletingLastPathComponent(),
                                                 withIntermediateDirectories: true)
        try? data.write(to: Self.fileURL, options: .atomic)
    }
}
