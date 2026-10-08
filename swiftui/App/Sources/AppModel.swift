// What the window shows: the open folder and its status. One shared instance, so the window and
// the control server (Control.swift) always see and change the same state.

import Foundation

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

    var folderName: String {
        repoPath.map { ($0 as NSString).lastPathComponent } ?? "Git Manager Native"
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

    /// Shows a changed file's staged or unstaged diff in the main area.
    func showDiff(_ file: FileStatus, staged: Bool) async {
        guard let repoPath else {
            return
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
    nonisolated static func readStatus(repoPath folderPath: String) -> Result<StatusSnapshot, BackendError> {
        do {
            let args = GetStatusArgs(repoPath: folderPath, knownHash: nil)
            return .success(try Backend.call("get_status", args) as StatusSnapshot)
        } catch let error as BackendError {
            return .failure(error)
        } catch {
            return .failure(BackendError(kind: "bridge", message: error.localizedDescription))
        }
    }

    func begin(_ folderPath: String) {
        repoPath = folderPath
        loading = true
    }

    func finish(_ result: Result<StatusSnapshot, BackendError>) {
        loading = false
        switch result {
        case .success(let snapshot):
            self.snapshot = snapshot
            errorText = nil
            // The Files panel shows the open folder, toned by its status.
            let files = FilesModel.shared
            if let repoPath, files.rootPath != repoPath {
                Task {
                    await files.open(rootPath: repoPath)
                }
            }
            files.updateTones(snapshot.status?.files ?? [])
        case .failure(let error):
            snapshot = nil
            errorText = error.message
        }
    }
}
