// What the window shows: the open folder and its status. One shared instance, so the window and
// the control server (Control.swift) always see and change the same state.

import Foundation
import NativeCore

@MainActor
final class AppModel: ObservableObject {
    static let shared = AppModel()

    @Published private(set) var repoPath: String?
    @Published private(set) var snapshot: StatusSnapshot?
    @Published private(set) var errorText: String?
    @Published private(set) var loading = false
    /// The status bar's memory readout, read every 2 seconds while the window shows (refreshMemory).
    @Published private(set) var memoryBytes: UInt64?
    /// The file diff open in the main area (a click on a Changes row); nil shows the welcome screen.
    @Published private(set) var openDiff: OpenDiff?
    /// The write running now ("Stage", "Commit"), shown in the header and the status bar; nil when idle.
    @Published var busy: String?
    /// Asks the commit box to put the cursor in its message (the heading's Commit button with no message).
    @Published var messageFocusRequests = 0
    let toasts = ToastCenter.shared
    let draft = CommitDraft()
    /// Where the open diff's row was in the list, so the selection stays at that place when its file goes away.
    private var lastRowIndex = 0

    /// The workspace's name (the header, the window title, the welcome screen): its folder names.
    var folderName: String {
        WorkspaceModel.shared.name ?? repoName
    }

    /// The active repository's name (the status bar).
    var repoName: String {
        WorkspaceModel.shared.repo(at: repoPath)?.name
            ?? repoPath.map { ($0 as NSString).lastPathComponent } ?? WorkspaceModel.shared.name ?? "Git Manager Native"
    }

    var changeCount: Int {
        snapshot?.status?.files.count ?? 0
    }

    func refreshMemory() async {
        let usage = await Task.detached { () -> MemoryUsage? in
            try? Backend.call("memory_usage", [String: String]()) as MemoryUsage
        }.value
        if let usage {
            memoryBytes = usage.totalBytes
        }
    }

    /// Shows a changed file's staged or unstaged diff in the main area; `reveal` brings the diff tab to the front
    /// (a click), where a refresh that follows the file leaves the tab on screen as it is.
    func showDiff(_ file: FileStatus, staged: Bool, reveal: Bool = true) async {
        guard let repoPath else {
            return
        }
        if reveal {
            EditorModel.shared.diffActive = true
        }
        let args = GetFileDiffArgs(
            repoPath: repoPath, filePath: file.path, origPath: file.origPath, area: staged ? "staged" : "unstaged"
        )
        let diff = await Task.detached { () -> FileDiff? in
            try? Backend.call("get_file_diff", args) as FileDiff
        }.value
        guard let diff else {
            return
        }
        lastRowIndex = rows().firstIndex(of: ChangeRow(path: file.path, staged: staged)) ?? lastRowIndex
        // A refresh that leaves the texts as they were keeps the diff and its colors.
        if let open = openDiff, open.filePath == file.path, open.staged == staged,
           open.diff.original == diff.original, open.diff.modified == diff.modified {
            return
        }
        openDiff = OpenDiff(filePath: file.path, staged: staged, diff: diff)
        async let original = SyntaxHighlighter.shared.spans(filePath: file.path, text: diff.original)
        async let modified = SyntaxHighlighter.shared.spans(filePath: file.path, text: diff.modified)
        let spans = await (original, modified)
        // Another file may have opened meanwhile.
        if openDiff?.filePath == file.path, openDiff?.staged == staged {
            openDiff?.originalSpans = spans.0
            openDiff?.modifiedSpans = spans.1
        }
    }

    func closeDiff() {
        openDiff = nil
        EditorModel.shared.diffActive = false
    }

    /// Reads the status again after a write or a click on Refresh; an unchanged status keeps the one on screen.
    /// The open diff then follows its file, into the other group when it was just staged or unstaged.
    func refreshStatus() async {
        guard let repoPath else {
            return
        }
        let knownHash = snapshot?.hash
        let result = await Task.detached {
            Self.readStatus(repoPath: repoPath, knownHash: knownHash)
        }.value
        guard self.repoPath == repoPath else {
            return
        }
        if case .success(let next) = result, next.status == nil {
            return
        }
        finish(result)
        await followSelection()
    }

    private func rows() -> [ChangeRow] {
        let groups = FileGroups(snapshot?.status?.files ?? [])
        return ChangeSelection.rows(staged: groups.staged.map(\.path), unstaged: groups.unstaged.map(\.path))
    }

    private func followSelection() async {
        guard let open = openDiff else {
            return
        }
        let current = ChangeRow(path: open.filePath, staged: open.staged)
        guard let next = ChangeSelection.follow(current, rows: rows(), lastIndex: lastRowIndex),
              let file = snapshot?.status?.files.first(where: { $0.path == next.path }) else {
            closeDiff()
            return
        }
        await showDiff(file, staged: next.staged, reveal: false)
    }

    /// Makes another repository of the workspace the active one (Set as Active Repository): its last status shows
    /// at once and is read again; file tabs stay open, as in the current app.
    func setActive(_ repoRoot: String) async {
        guard repoRoot != repoPath else {
            return
        }
        closeDiff()
        repoPath = repoRoot
        snapshot = WorkspaceModel.shared.statuses[repoRoot].map { StatusSnapshot(hash: "", status: $0) }
        await refreshStatus()
    }

    /// Opens a folder from the UI: reads its status off the main thread.
    func open(repoPath folderPath: String) async {
        begin(folderPath)
        let result = await Task.detached {
            Self.readStatus(repoPath: folderPath)
        }.value
        finish(result)
    }

    /// Reads the status on the caller's thread (the control server's) and returns it, so a tool call
    /// can answer with what the window then shows.
    nonisolated static func readStatus(
        repoPath folderPath: String, knownHash: String? = nil
    ) -> Result<StatusSnapshot, BackendError> {
        do {
            let args = GetStatusArgs(repoPath: folderPath, knownHash: knownHash)
            return .success(try Backend.call("get_status", args) as StatusSnapshot)
        } catch let error as BackendError {
            return .failure(error)
        } catch {
            return .failure(BackendError(kind: "bridge", message: error.localizedDescription))
        }
    }

    /// A workspace without any repository (ChangesView.svelte .no-repo): nothing is active and no status is read;
    /// the Files panel shows its folders.
    func showNoRepository() {
        if repoPath != nil {
            openDiff = nil
            EditorModel.shared.reset()
        }
        repoPath = nil
        snapshot = nil
        errorText = nil
        loading = false
        let files = FilesModel.shared
        let roots = WorkspaceModel.shared.folders.map(\.root)
        if files.roots != roots {
            Task {
                await files.open(roots: roots)
            }
        }
        files.updateTones([])
    }

    func begin(_ folderPath: String) {
        if repoPath != folderPath {
            openDiff = nil
            EditorModel.shared.reset()
        }
        repoPath = folderPath
        loading = true
    }

    func finish(_ result: Result<StatusSnapshot, BackendError>) {
        loading = false
        switch result {
        case .success(let snapshot):
            self.snapshot = snapshot
            errorText = nil
            let workspace = WorkspaceModel.shared
            if let repoPath {
                workspace.record(repoRoot: repoPath, snapshot: snapshot)
            }
            // The Files panel shows the workspace folders, toned by every repository's status.
            let files = FilesModel.shared
            let roots = workspace.folders.isEmpty ? [repoPath].compactMap { $0 } : workspace.folders.map(\.root)
            if !roots.isEmpty, files.roots != roots {
                Task {
                    await files.open(roots: roots)
                }
            }
            if workspace.repos.isEmpty, let repoPath {
                files.updateTones((snapshot.status?.files ?? []).map { (repoRoot: repoPath, file: $0) })
            } else {
                files.updateTones(workspace.toneFiles())
            }
        case .failure(let error):
            snapshot = nil
            errorText = error.message
        }
    }
}
