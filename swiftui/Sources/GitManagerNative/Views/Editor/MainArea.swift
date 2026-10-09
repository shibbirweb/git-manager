// The main area: the welcome screen while nothing is open, else the tab strip over the diff or the active file.

import SwiftUI

struct MainArea: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var diffs = DiffStore.shared
    @ObservedObject private var editor = EditorModel.shared
    @ObservedObject private var workspace = WorkspaceModel.shared

    var body: some View {
        if model.openDiff == nil && diffs.pendingName == nil && editor.tabs.tabs.isEmpty {
            EditorArea {
                if model.repoPath != nil || !workspace.folders.isEmpty {
                    RepoCrumb(crumbs: crumbs)
                }
            } content: {
                WelcomeView(title: model.folderName, hasRepository: model.repoPath != nil)
            }
        } else {
            let diffShown = model.openDiff != nil && (editor.diffActive || editor.tabs.tabs.isEmpty)
            let pending = model.openDiff == nil && diffs.pendingName != nil && editor.diffActive
            VStack(spacing: 0) {
                EditorTabStrip(
                    diffName: model.openDiff.map { FileRow.split($0.filePath).name } ?? diffs.pendingName,
                    diffActive: diffShown || pending,
                    tabs: editor.tabs,
                    selectDiff: { editor.diffActive = true },
                    closeDiff: model.closeDiff,
                    select: { path in Task { await editor.activate(path) } },
                    keep: editor.keep,
                    close: { path in Task { await editor.close(path) } }
                )
                if diffShown, let open = model.openDiff {
                    DiffScreen(open: open)
                        // Each file and area keeps its own folds, change and scroll, as the current app rebuilds per
                        // file.
                        .id("\(open.staged ? "staged" : "unstaged"):\(open.filePath)")
                } else if let file = editor.file, !pending {
                    FileScreen(file: file)
                        .id(file.path)
                } else {
                    Text(editor.message ?? "")
                        .foregroundStyle(theme.ink("--text-dim"))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(theme.color("--editor-bg"))
                }
            }
        }
    }

    /// The crumbs to the active repository: the workspace (several folders), its folder, the folders down to it.
    private var crumbs: [NavCrumb] {
        let accent = model.changeCount > 0
        // No repository in the workspace: the folder itself, dim.
        if model.repoPath == nil, let folder = workspace.folders.first {
            let several = workspace.folders.count > 1
            let workspaceCrumb = several ? workspace.name.map { [NavCrumb(icon: "app-window", name: $0)] } : nil
            return (workspaceCrumb ?? []) + [NavCrumb(icon: "folder", name: folder.name)]
        }
        guard let repoPath = model.repoPath,
              let folder = workspace.folders.first(where: { repoPath == $0.root || repoPath.hasPrefix($0.root + "/") })
        else {
            return [NavCrumb(icon: "folder-git", name: model.repoName, accent: accent)]
        }
        var crumbs: [NavCrumb] = []
        if workspace.folders.count > 1, let name = workspace.name {
            crumbs.append(NavCrumb(icon: "app-window", name: name))
        }
        let folderIsRepo = workspace.repo(at: folder.root) != nil
        crumbs.append(NavCrumb(icon: folderIsRepo ? "folder-git" : "folder", name: folder.name,
                               accent: folder.root == repoPath && accent))
        var dirPath = folder.root
        for part in repoPath.dropFirst(folder.root.count).split(separator: "/") {
            dirPath += "/\(part)"
            let isRepo = workspace.repo(at: dirPath) != nil
            crumbs.append(NavCrumb(icon: isRepo ? "folder-git" : nil, name: String(part),
                                   accent: dirPath == repoPath && accent))
        }
        return crumbs
    }
}
