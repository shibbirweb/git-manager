// Workspace files (repo.svelte.ts openWorkspaceFile and saveWorkspaceAs, repoPicker.ts): a saved set of folders in
// a .gitmanager-workspace or VS Code .code-workspace file, read and written by the bridge (src-tauri's
// workspace_file.rs). An opened or saved file names the workspace and goes to the top of the recent projects.

import AppKit
import NativeCore
import UniformTypeIdentifiers

struct WorkspaceFileArgs: Encodable {
    let filePath: String
}

struct WriteWorkspaceFileArgs: Encodable {
    let filePath: String
    let folders: [String]
}

/// A workspace file's folders that exist and the ones that do not (workspace_file.rs WorkspaceFile).
struct SavedWorkspace: Decodable {
    let name: String
    let folders: [String]
    let missing: [String]
}

extension AppModel {
    func openWorkspaceFile(_ filePath: String) async {
        let result = await Task.detached {
            Result { try Backend.call("read_workspace_file", WorkspaceFileArgs(filePath: filePath)) as SavedWorkspace }
        }.value
        guard case .success(let saved) = result else {
            if case .failure(let error) = result {
                toasts.show(.error, "Could not open \((filePath as NSString).lastPathComponent)",
                            detail: Self.describe(error))
            }
            return
        }
        if !saved.missing.isEmpty {
            let count = saved.missing.count
            toasts.show(.info, "\(count) \(count == 1 ? "folder was" : "folders were") not found",
                        detail: saved.missing.joined(separator: "\n"))
        }
        guard !saved.folders.isEmpty else {
            toasts.show(.error, "The workspace file lists no folders that exist")
            return
        }
        await openFolders(saved.folders, file: filePath)
    }

    /// Saves the open folders to `filePath` (the app's suffix added when it has none) and links the workspace to it.
    func saveWorkspaceAs(_ filePath: String) async {
        let workspace = WorkspaceModel.shared
        let folders = workspace.folders.map(\.root)
        guard !folders.isEmpty else {
            return
        }
        let target = WorkspaceRules.workspaceFilePath(filePath)
        let result = await Task.detached {
            Result {
                try Backend.perform("write_workspace_file", WriteWorkspaceFileArgs(filePath: target, folders: folders))
            }
        }.value
        if case .failure(let error) = result {
            toasts.show(.error, "Could not save workspace", detail: Self.describe(error))
            return
        }
        workspace.linkFile(target)
        RecentProjectsStore.shared.opened(folders, file: target)
    }

    /// Open Workspace from File...: a file picker for workspace files.
    func pickAndOpenWorkspaceFile() {
        let panel = NSOpenPanel()
        panel.title = "Open Workspace from File"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = ["gitmanager-workspace", "code-workspace"].compactMap {
            UTType(filenameExtension: $0)
        }
        if panel.runModal() == .OK, let filePath = panel.url?.path {
            Task {
                await openWorkspaceFile(filePath)
            }
        }
    }

    /// Save Workspace to File... / Save Workspace As...: next to the first folder, named after the workspace.
    func pickAndSaveWorkspace() {
        let workspace = WorkspaceModel.shared
        guard let first = workspace.folders.first?.root else {
            return
        }
        let panel = NSSavePanel()
        panel.title = "Save Workspace As"
        if let file = workspace.file {
            panel.directoryURL = URL(fileURLWithPath: (file as NSString).deletingLastPathComponent)
            panel.nameFieldStringValue = (file as NSString).lastPathComponent
        } else {
            let name = (workspace.name ?? "").replacingOccurrences(of: #"[^\w.-]+"#, with: "-",
                                                                   options: .regularExpression)
            panel.directoryURL = URL(fileURLWithPath: (first as NSString).deletingLastPathComponent)
            panel.nameFieldStringValue = (name.isEmpty ? "workspace" : name) + ".gitmanager-workspace"
        }
        if panel.runModal() == .OK, let filePath = panel.url?.path {
            Task {
                await saveWorkspaceAs(filePath)
            }
        }
    }
}
