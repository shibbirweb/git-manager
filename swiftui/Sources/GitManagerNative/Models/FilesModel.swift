// The Files panel's state: the listed folders of the open folder (bridge `list_directories`, as the current app's
// FileExplorer lists them), which ones are open, and each path's tone from the git status (src/lib/views/files/
// tones.ts): a file's own tone, a folder's the strongest tone inside it.

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
        for file in files {
            let tone = FileTone(file)
            next[file.path] = max(next[file.path] ?? tone, tone)
            var folder = file.path
            while let slash = folder.lastIndex(of: "/") {
                folder = String(folder[..<slash])
                next[folder] = max(next[folder] ?? tone, tone)
            }
        }
        tones = next
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
