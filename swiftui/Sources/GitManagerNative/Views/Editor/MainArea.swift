// The main area: the welcome screen while nothing is open, else the tab strip over the diff or the active file.

import SwiftUI

struct MainArea: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var model = AppModel.shared
    @ObservedObject private var editor = EditorModel.shared
    @ObservedObject private var workspace = WorkspaceModel.shared

    var body: some View {
        if model.openDiff == nil && editor.tabs.tabs.isEmpty {
            EditorArea {
                if model.repoPath != nil {
                    RepoCrumb(name: model.repoName, hasChanges: model.changeCount > 0, folderName: crumbFolder)
                }
            } content: {
                WelcomeView(title: model.folderName)
            }
        } else {
            let diffShown = model.openDiff != nil && (editor.diffActive || editor.tabs.tabs.isEmpty)
            VStack(spacing: 0) {
                EditorTabStrip(
                    diffName: model.openDiff.map { FileRow.split($0.filePath).name },
                    diffActive: diffShown,
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
                } else if let file = editor.file {
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

    /// The workspace folder's name when the active repository lies inside it.
    private var crumbFolder: String? {
        guard let root = workspace.root, root != model.repoPath else {
            return nil
        }
        return workspace.folders.first?.name
    }
}
