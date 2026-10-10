// The diff's blame while the toolbar's Blame is on (DiffView.svelte, blame.ts loadBlame): in Changes the modified
// text blamed against the work tree's history (blame_contents), in the Log the file at the commit (blame_file; none
// for a deleted file, whose new side is empty). Read again only when the text or the commit changes.

import Foundation
import NativeCore

private struct BlameFileArgs: Encodable {
    let repoPath: String
    let filePath: String
    let revision: String?
}

extension DiffState {
    func loadBlame(open: OpenDiff, repoPath: String?, on: Bool) async {
        guard on, let repoPath, !open.diff.binary, !open.diff.tooLarge else {
            return
        }
        let text = open.diff.modified
        if open.readonly && text.isEmpty {
            return
        }
        let key = "\(repoPath)\n\(open.filePath)\n\(open.commitId ?? "")\n\(text)"
        guard key != blameKey else {
            return
        }
        let filePath = open.filePath
        let contents = BlameContentsArgs(repoPath: repoPath, filePath: filePath, eol: open.diff.modifiedEol ?? "lf",
                                         text: text)
        let revision = open.readonly ? open.commitId : nil
        let runs = await Task.detached { () -> BlameRuns in
            let answer: BlameRuns? = revision == nil
                ? try? Backend.call("blame_contents", contents)
                : try? Backend.call("blame_file", BlameFileArgs(repoPath: repoPath, filePath: filePath,
                                                                revision: revision))
            return answer ?? BlameRuns(commits: [], runs: [])
        }.value
        blameKey = key
        blame = BlameLines(runs, lineCount: text.components(separatedBy: "\n").count)
    }
}
