// The Log's selection (LogView.svelte, CommitDetails.svelte): selecting a commit loads its details and selects its
// first changed file (or keeps the file when the new commit changed it too), whose diff against the commit's first
// parent then loads. A newer selection drops what an older one was still loading.

import Foundation
import NativeCore

extension LogModel {
    /// Selects `commitId` (nil clears) and loads its details and first file's diff.
    func select(_ commitId: String?, repoPath: String? = nil) async {
        selectedId = commitId
        guard let commitId, let repoPath = repoPath ?? context.app.repoPath else {
            details = nil
            return
        }
        let args = CommitIdArgs(repoPath: repoPath, commitId: commitId)
        let result = await Task.detached { () -> Result<CommitDetails, BackendError> in
            Self.read { try Backend.call("get_commit_details", args) as CommitDetails }
        }.value
        guard selectedId == commitId else {
            return
        }
        switch result {
        case .success(let loaded):
            let keep = loaded.files.contains { $0.path == selectedPath }
            details = loaded
            await selectFile(keep ? selectedPath : loaded.files.first?.path, repoPath: repoPath)
        case .failure:
            details = nil
            await selectFile(nil, repoPath: repoPath)
        }
    }

    /// Selects one of the commit's files and loads its diff (getCommitFileDiff), then its syntax colors.
    func selectFile(_ filePath: String?, repoPath: String) async {
        selectedPath = filePath
        diffSettled = false
        defer {
            if selectedPath == filePath {
                diffSettled = true
            }
        }
        guard let filePath, let commit = details, let file = commit.files.first(where: { $0.path == filePath }) else {
            diff = nil
            return
        }
        let args = CommitFileArgs(repoPath: repoPath, commitId: commit.id, filePath: file.path, origPath: file.origPath)
        let result = await Task.detached { () -> Result<FileDiff, BackendError> in
            Self.read { try Backend.call("get_commit_file_diff", args) as FileDiff }
        }.value
        guard selectedPath == filePath, details?.id == commit.id, case .success(let fileDiff) = result else {
            return
        }
        let label = String(commit.id.prefix(8))
        let summary = LogFormat.splitMessage(commit.message).subject
        let note = "\(commit.authorName), \(LogFormat.relativeTime(commit.authorTime)) \u{2022} "
            + (summary.isEmpty ? "(no message)" : summary)
        diff = OpenDiff(filePath: file.path, staged: false, diff: fileDiff, commitLabel: label, commitNote: note)
        await SyntaxHighlighter.shared.diffSpans(
            filePath: file.path, original: fileDiff.original, modified: fileDiff.modified,
            hunks: fileDiff.hunks.compactMap(DiffHunk.init)
        ) { original, modified in
            guard diff?.filePath == file.path, diff?.commitLabel == label else {
                return false
            }
            diff?.originalSpans = original
            diff?.modifiedSpans = modified
            return true
        }
    }

    /// The commit at `position` of what the list shows (filtered or not).
    func commit(at position: Int) -> CommitSummary? {
        let index = filtered.map { $0.indices.contains(position) ? $0[position] : -1 } ?? position
        return commits.indices.contains(index) ? commits[index] : nil
    }

    /// Where the selected commit is in what the list shows; -1 when it is not there.
    var selectedPosition: Int {
        guard let selectedId, let index = index(of: selectedId) else {
            return -1
        }
        guard let filtered else {
            return index
        }
        return filtered.firstIndex(of: index) ?? -1
    }

    /// A loaded commit's short id, for the details' parent links; nil for one not loaded yet.
    func loadedShortId(_ commitId: String) -> String? {
        index(of: commitId).map { commits[$0].shortId }
    }
}
