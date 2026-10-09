// The Files panel's state: the listed folders of the open folder (bridge `list_directories`, as the current app's
// FileExplorer lists them), which ones are open, and each path's tone from the git status (src/lib/views/files/
// tones.ts): a file's own tone, a folder's the strongest tone inside it. Files git knows were deleted are listed in
// their folder too (FileExplorer's entriesOf), struck through.

import Foundation

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

    @Published private(set) var rootPath: String?
    /// Folder (relative, "" for the root) to its entries, for every folder listed so far.
    @Published private(set) var listings: [String: [DirEntry]] = [:]
    @Published private(set) var expanded: Set<String> = []
    /// Relative path to tone, for changed files and the folders that hold them.
    @Published private(set) var tones: [String: FileTone] = [:]
    /// Folder (relative, "" for the root) to the names of the files deleted from it (tones.ts deletedByFolder).
    @Published private(set) var deleted: [String: [String]] = [:]

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

    func open(rootPath folderPath: String) async {
        rootPath = folderPath
        listings = [:]
        expanded = []
        await list([""])
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

    func updateTones(_ files: [FileStatus]) {
        var next: [String: FileTone] = [:]
        var gone: [String: [String]] = [:]
        for file in files {
            if FileTone(file) == .deleted {
                let slash = file.path.lastIndex(of: "/")
                let folder = slash.map { String(file.path[..<$0]) } ?? ""
                let name = slash.map { String(file.path[file.path.index(after: $0)...]) } ?? file.path
                gone[folder, default: []].append(name)
            }
            let tone = FileTone(file)
            next[file.path] = max(next[file.path] ?? tone, tone)
            var folder = file.path
            while let slash = folder.lastIndex(of: "/") {
                folder = String(folder[..<slash])
                next[folder] = max(next[folder] ?? tone, tone)
            }
        }
        tones = next
        deleted = gone
    }

    private func list(_ dirPaths: [String]) async {
        guard let rootPath else {
            return
        }
        let args = ListDirectoriesArgs(rootPath: rootPath, dirPaths: dirPaths, repoRoots: [rootPath])
        let result = await Task.detached { () -> [FolderListing]? in
            try? Backend.call("list_directories", args) as [FolderListing]
        }.value
        for listing in result ?? [] where listing.error == nil {
            listings[listing.dirPath] = listing.entries
        }
    }
}
