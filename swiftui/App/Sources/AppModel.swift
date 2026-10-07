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
        case .failure(let error):
            snapshot = nil
            errorText = error.message
        }
    }
}
