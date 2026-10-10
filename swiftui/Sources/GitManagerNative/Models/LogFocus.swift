// A commit asked for from elsewhere, such as a blame click (LogView.svelte focusCommit, CommitDetails.svelte
// revealLine): the Log shows with no filter, loads history page by page (at most 20 more) until the commit is there,
// selects it on the asked file and centers it in the list; the diff then centers the asked line, found again by its
// text when only guessed (lineMatch.ts findLine).

import Foundation
import NativeCore

extension LogModel {
    static let maxFocusPages = 20

    func focus(repoPath: String, commitId: String, filePath: String?, line: Int?, lineText: String?) async {
        filterText = ""
        show(repoPath: nil)
        // Read afresh, as the Log view does when it mounts: the commit may be newer than the loaded history.
        await reload(repoPath: repoPath)
        var pages = 0
        while index(of: commitId) == nil && hasMore && pages < Self.maxFocusPages {
            let before = commits.count
            await loadMore()
            pages += 1
            if commits.count == before && !hasMore {
                break
            }
        }
        guard index(of: commitId) != nil else {
            selectedId = commitId
            context.toasts.show(.info, "Commit is not in the loaded history",
                                detail: allRefs ? nil : "Try showing all branches.")
            return
        }
        if let filePath {
            selectedPath = filePath
        }
        await select(commitId, repoPath: repoPath)
        centerRequests += 1
        guard let line, let shown = diff, shown.filePath == filePath || filePath == nil else {
            return
        }
        let target = BlameLines.findLine(shown.diff.modified, hintLine: line, lineText: lineText)
        revealTokens += 1
        diff?.reveal = OpenDiff.Reveal(line: target, token: revealTokens)
    }
}

extension LogModel {
    /// HEAD moved (a commit, a checkout): a Log on screen reads the history again, as the page does when the branch
    /// tips change (historyVersion).
    func headMoved(repoPath: String) {
        if shown {
            Task {
                await reload(repoPath: repoPath)
            }
        }
    }
}
