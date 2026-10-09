// Recent projects, as the current app keeps and lists them: state.json's recentFolders, recentWorkspaces and
// recentWorkspaceFiles (settingsData.ts parseState), the entries the folder menu and the welcome screen show
// (recentEntries.ts), and the welcome list's badges, search and keys (welcomeModel.ts).

import Foundation

public struct RecentLists: Equatable, Sendable {
    public var workspaceFiles: [String] = []
    public var workspaces: [[String]] = []
    public var folders: [String] = []

    /// MAX_RECENT in settingsData.ts.
    public static let limit = 12

    public init(workspaceFiles: [String] = [], workspaces: [[String]] = [], folders: [String] = []) {
        self.workspaceFiles = workspaceFiles
        self.workspaces = workspaces
        self.folders = folders
    }

    /// The lists from state.json's object; anything else in it is ignored here and kept by the caller.
    public init(state: [String: Any]) {
        folders = Array(Self.strings(state["recentFolders"] ?? state["recentRepos"]).prefix(Self.limit))
        workspaces = Array(((state["recentWorkspaces"] as? [Any]) ?? []).map(Self.strings).filter { $0.count > 1 }
            .prefix(Self.limit))
        workspaceFiles = Array(Self.strings(state["recentWorkspaceFiles"]).prefix(Self.limit))
    }

    /// The keys state.json saves them under.
    public var stateValues: [String: Any] {
        ["recentFolders": folders, "recentWorkspaces": workspaces, "recentWorkspaceFiles": workspaceFiles]
    }

    /// A folder opened alone moves to the top of the recent folders (addRecent).
    public mutating func addFolder(_ folderPath: String) {
        folders = Array(([folderPath] + folders.filter { $0 != folderPath }).prefix(Self.limit))
    }

    /// Several folders opened together move to the top of the recent workspaces (rememberSession).
    public mutating func addWorkspace(_ folderPaths: [String]) {
        guard folderPaths.count > 1 else {
            return
        }
        workspaces = Array(([folderPaths] + workspaces.filter { $0 != folderPaths }).prefix(Self.limit))
    }

    public mutating func remove(_ entry: RecentEntry) {
        switch entry.kind {
        case .workspaceFile(let filePath):
            workspaceFiles.removeAll { $0 == filePath }
        case .workspace(let folderPaths):
            workspaces.removeAll { $0 == folderPaths }
        case .folder(let folderPath):
            folders.removeAll { $0 == folderPath }
        }
    }

    private static func strings(_ value: Any?) -> [String] {
        ((value as? [Any]) ?? []).compactMap { $0 as? String }
    }
}

public struct RecentEntry: Equatable, Sendable {
    public enum Kind: Equatable, Sendable {
        case workspaceFile(String)
        case workspace([String])
        case folder(String)
    }

    public let kind: Kind
    public let label: String
    public let hint: String

    /// What identifies it: its file, its folder, or its folders one per line (entryKey).
    public var key: String {
        paths.joined(separator: "\n")
    }

    /// The paths it stands for (entryPaths).
    public var paths: [String] {
        switch kind {
        case .workspaceFile(let filePath):
            return [filePath]
        case .workspace(let folderPaths):
            return folderPaths
        case .folder(let folderPath):
            return [folderPath]
        }
    }

    /// The dim line under the name on the welcome screen (entrySubtitle).
    public var subtitle: String {
        paths.map(RecentProjects.shortPath).joined(separator: ", ")
    }
}

public enum RecentProjects {
    /// Recent workspace files, then multi-folder workspaces, then single folders, leaving out what is open.
    public static func entries(_ lists: RecentLists, openFile: String? = nil, openRoots: [String] = [])
        -> [RecentEntry] {
        var entries: [RecentEntry] = []
        for filePath in lists.workspaceFiles where filePath != openFile {
            entries.append(RecentEntry(kind: .workspaceFile(filePath), label: workspaceFileLabel(filePath),
                                       hint: "workspace file"))
        }
        for folderPaths in lists.workspaces where folderPaths != openRoots {
            let names = folderPaths.map(folderName)
            let more = names.count > 3 ? " +\(names.count - 3)" : ""
            entries.append(RecentEntry(kind: .workspace(folderPaths),
                                       label: names.prefix(3).joined(separator: ", ") + more,
                                       hint: "\(folderPaths.count) folders"))
        }
        for folderPath in lists.folders where !(openRoots.count == 1 && openRoots[0] == folderPath) {
            entries.append(RecentEntry(kind: .folder(folderPath), label: folderName(folderPath),
                                       hint: shortPath(folderPath)))
        }
        return entries
    }

    /// A path with /Users/<name> as "~".
    public static func shortPath(_ path: String) -> String {
        path.replacingOccurrences(of: #"^/Users/[^/]+"#, with: "~", options: .regularExpression)
    }

    public static func folderName(_ folderPath: String) -> String {
        folderPath.split(separator: "/").last.map(String.init) ?? folderPath
    }

    static func workspaceFileLabel(_ filePath: String) -> String {
        let name = folderName(filePath)
        return name.replacingOccurrences(of: #"\.(gitmanager|code)-workspace$"#, with: "", options: .regularExpression)
    }
}
