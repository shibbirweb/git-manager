// The Clone dialog's state (CloneDialog.svelte): the URL, the parent folder and the folder name (from the URL until
// edited), the clone running with git's latest progress line, and how it ended. A clone runs in the bridge; its
// progress is read every 200 ms while it runs. Afterwards the new folder opens or joins the workspace.

import AppKit
import NativeCore

struct CloneArgs: Encodable {
    let url: String
    let parentDir: String
    let folderName: String
    let cancelId: String
}

struct CancelArgs: Encodable {
    let cancelId: String
}

@MainActor
final class CloneCenter: ObservableObject {
    static let shared = CloneCenter()

    @Published var shown = false
    @Published var url = "" {
        didSet {
            if !folderEdited {
                folderName = CloneRules.folderName(url)
            }
        }
    }
    @Published var parentDir = ""
    @Published var folderName = ""
    /// The folder name follows the URL until the user types one.
    var folderEdited = false
    @Published private(set) var cloning = false
    @Published private(set) var progressLine = ""
    @Published private(set) var cloneError: String?
    @Published private(set) var cloneNotice: String?
    @Published private(set) var cancelling = false
    private var cancelId: String?

    var canClone: Bool {
        !cloning && CloneRules.urlError(url) == nil && CloneRules.folderNameError(folderName) == nil
            && !parentDir.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var targetPath: String {
        let parent = parentDir.trimmingCharacters(in: .whitespaces)
        let name = folderName.trimmingCharacters(in: .whitespaces)
        guard !parent.isEmpty, !name.isEmpty else {
            return ""
        }
        return parent.replacingOccurrences(of: #"/+$"#, with: "", options: .regularExpression) + "/" + name
    }

    /// Opens the dialog: next to the open folder, else in the home folder.
    func open() {
        url = ""
        folderName = ""
        folderEdited = false
        cloneError = nil
        cloneNotice = nil
        progressLine = ""
        let root = WorkspaceModel.shared.root
        let home = ProcessInfo.processInfo.environment["HOME"].flatMap { $0.isEmpty ? nil : $0 } ?? NSHomeDirectory()
        parentDir = root.map { ($0 as NSString).deletingLastPathComponent } ?? home
        shown = true
    }

    func close() {
        if !cloning {
            shown = false
        }
    }

    func browse() {
        let panel = NSOpenPanel()
        panel.title = "Clone Into"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.directoryURL = URL(fileURLWithPath: parentDir)
        if panel.runModal() == .OK, let folderPath = panel.url?.path {
            parentDir = folderPath
        }
    }

    func cancel() {
        guard let cancelId, !cancelling else {
            return
        }
        cancelling = true
        progressLine = "Cancelling..."
        Task.detached {
            _ = try? Backend.call("cancel_git_command", CancelArgs(cancelId: cancelId)) as Bool
        }
    }

    func submit() {
        guard canClone else {
            return
        }
        let args = CloneArgs(url: url.trimmingCharacters(in: .whitespaces), parentDir: parentDir,
                             folderName: folderName.trimmingCharacters(in: .whitespaces),
                             cancelId: "clone-\(UUID().uuidString)")
        cloning = true
        cloneError = nil
        cloneNotice = nil
        cancelling = false
        cancelId = args.cancelId
        progressLine = "Starting..."
        Task {
            let poll = Task {
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 200_000_000)
                    if let line = try? Backend.call("clone_progress", [String: String]()) as String, !line.isEmpty {
                        progressLine = line
                    }
                }
            }
            let result = await Task.detached {
                Result { try Backend.call("clone_repository", args) as String }
            }.value
            poll.cancel()
            finish(result)
        }
    }

    private func finish(_ result: Result<String, Error>) {
        cloning = false
        cancelId = nil
        switch result {
        case .success(let clonedPath):
            shown = false
            offerToOpen(clonedPath)
        case .failure(let error):
            let message = AppModel.describe(error)
            if cancelling && message == "Clone cancelled" {
                cloneNotice = message
            } else {
                cloneError = message
            }
        }
    }

    /// Cloned: open it here, add it to the workspace, or leave it.
    private func offerToOpen(_ clonedPath: String) {
        let name = (clonedPath as NSString).lastPathComponent
        let hasWorkspace = !WorkspaceModel.shared.folders.isEmpty
        let alert = NSAlert()
        alert.messageText = "Cloned \(name)"
        alert.informativeText = clonedPath
        alert.addButton(withTitle: "Open in This Window")
        if hasWorkspace {
            alert.addButton(withTitle: "Add to Workspace")
        }
        alert.addButton(withTitle: "Not Now")
        let model = AppModel.shared
        switch alert.runModal() {
        case .alertFirstButtonReturn:
            Task { await model.openFolder(clonedPath) }
        case .alertSecondButtonReturn where hasWorkspace:
            let roots = WorkspaceModel.shared.folders.map(\.root)
            Task { await model.openFolders(roots + [clonedPath]) }
        default:
            ToastCenter.shared.show(.success, "Cloned \(name)", detail: clonedPath)
        }
    }
}
