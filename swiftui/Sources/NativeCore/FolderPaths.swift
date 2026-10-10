// Absolute paths in a workspace of several folders (src/lib/stores/workspacePaths.ts folderFor): which workspace
// folder holds a path, and the folders a change's tone reaches in the Files panel.

public enum FolderPaths {
    /// The workspace folder that holds `path` (the deepest one when folders nest), or nil outside every folder.
    public static func root(of path: String, roots: [String]) -> String? {
        roots.filter { path == $0 || path.hasPrefix($0 + "/") }.max { $0.count < $1.count }
    }

    /// The folders from `path`'s own folder up to its workspace folder, nearest first.
    public static func folders(of path: String, roots: [String]) -> [String] {
        var folders: [String] = []
        var dirPath = parent(path)
        while let root = root(of: dirPath, roots: roots) {
            folders.append(dirPath)
            if dirPath == root {
                break
            }
            dirPath = parent(dirPath)
        }
        return folders
    }

    public static func parent(_ path: String) -> String {
        guard let slash = path.lastIndex(of: "/"), slash != path.startIndex else {
            return "/"
        }
        return String(path[..<slash])
    }
}
