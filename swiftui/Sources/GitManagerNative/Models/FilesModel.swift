// The Files panel's state: the listed folders of the workspace folders (bridge `list_directories`, as the current
// app's FileExplorer lists them), which ones are open, and each path's tone from every repository's status
// (src/lib/views/files/tones.ts): a file's own tone, a folder's the strongest tone inside it. Files git knows were
// deleted are listed in their folder too (FileExplorer's entriesOf), struck through. Paths are absolute, as on the
// page, so several workspace folders share one tree.

import Foundation
import NativeCore

struct DirEntry: Decodable, Hashable {
    let name: String
    let isDir: Bool
    let ignored: Bool
    let isRepo: Bool
}

struct FolderListing: Decodable {
    let dirPath: String
    let entries: [DirEntry]
    let error: String?
}

private struct ListDirectoriesArgs: Encodable {
    let rootPath: String
    let dirPaths: [String]
    let repoRoots: [String]
}

enum FileTone: Int, Comparable {
    case deleted = 1
    case added
    case modified
    case conflict

    static func < (left: FileTone, right: FileTone) -> Bool {
        left.rawValue < right.rawValue
    }

    /// The tone of one changed file, as the current app's toneOf.
    init(_ file: FileStatus) {
        if file.conflicted {
            self = .conflict
        } else if file.unstaged == "deleted" || (file.staged == "deleted" && file.unstaged == nil) {
            self = .deleted
        } else if file.unstaged == "untracked" || (file.staged == "added" && file.unstaged == nil) {
            self = .added
        } else {
            self = .modified
        }
    }
}

@MainActor
final class FilesModel: ObservableObject {
    static let shared = FilesModel()

    /// The workspace folders; with several, each is a top-level row.
    @Published private(set) var roots: [String] = []
    /// Folder to its entries, for every folder listed so far.
    @Published private(set) var listings: [String: [DirEntry]] = [:]
    @Published private(set) var expanded: Set<String> = []
    /// Path to tone, for changed files and the folders that hold them, up to their workspace folder.
    @Published private(set) var tones: [String: FileTone] = [:]
    /// Folder to the names of the files deleted from it (tones.ts deletedByFolder).
    @Published private(set) var deleted: [String: [String]] = [:]
    /// The last changes, so the tones are worked out again once the folders are known (the first status arrives
    /// before them).
    private var changes: [(repoRoot: String, file: FileStatus)] = []

    var multiRoot: Bool {
        roots.count > 1
    }

    /// A folder's entries on disk plus the files deleted from it, folders first, then by name ignoring case.
    func entries(in dirPath: String) -> [DirEntry] {
        guard let onDisk = listings[dirPath] else {
            return []
        }
        let gone = deleted[dirPath] ?? []
        if gone.isEmpty {
            return onDisk
        }
        let present = Set(onDisk.map(\.name))
        let extra = gone.filter { !present.contains($0) }
            .map { DirEntry(name: $0, isDir: false, ignored: false, isRepo: false) }
        return (onDisk + extra).sorted { left, right in
            if left.isDir != right.isDir {
                return left.isDir
            }
            return left.name.lowercased() < right.name.lowercased()
        }
    }

    /// Shows the workspace folders, each open, as the page starts.
    func open(roots folderPaths: [String]) async {
        roots = folderPaths
        listings = [:]
        expanded = Set(folderPaths)
        updateTones(changes)
        await list(folderPaths)
    }

    func toggle(_ dirPath: String) async {
        if expanded.contains(dirPath) {
            expanded.remove(dirPath)
            return
        }
        expanded.insert(dirPath)
        if listings[dirPath] == nil {
            await list([dirPath])
        }
    }

    /// Each changed file by its repository's root; tones reach up through its folders to its workspace folder.
    func updateTones(_ changes: [(repoRoot: String, file: FileStatus)]) {
        self.changes = changes
        var next: [String: FileTone] = [:]
        var gone: [String: [String]] = [:]
        for change in changes {
            let path = (change.repoRoot as NSString).appendingPathComponent(change.file.path)
            let tone = FileTone(change.file)
            let folder = (path as NSString).deletingLastPathComponent
            if tone == .deleted {
                gone[folder, default: []].append((path as NSString).lastPathComponent)
            }
            next[path] = max(next[path] ?? tone, tone)
            for dirPath in FolderPaths.folders(of: path, roots: roots) {
                next[dirPath] = max(next[dirPath] ?? tone, tone)
            }
        }
        tones = next
        deleted = gone
    }

    /// The workspace folder that holds `path` (the deepest, when folders nest).
    func root(of path: String) -> String? {
        FolderPaths.root(of: path, roots: roots)
    }

    private func list(_ dirPaths: [String]) async {
        // Every repository of the workspace, so their folders show the repository icon.
        let repoRoots = Array(Set(roots + WorkspaceModel.shared.repos.map(\.root)))
        let byRoot = Dictionary(grouping: dirPaths) { root(of: $0) ?? "" }
        for (rootPath, paths) in byRoot where !rootPath.isEmpty {
            let relative = paths.map { $0 == rootPath ? "" : String($0.dropFirst(rootPath.count + 1)) }
            let args = ListDirectoriesArgs(rootPath: rootPath, dirPaths: relative, repoRoots: repoRoots)
            let result = await Task.detached { () -> [FolderListing]? in
                try? Backend.call("list_directories", args) as [FolderListing]
            }.value
            for listing in result ?? [] where listing.error == nil {
                let dirPath = listing.dirPath.isEmpty ? rootPath : "\(rootPath)/\(listing.dirPath)"
                listings[dirPath] = listing.entries
            }
        }
    }
}
