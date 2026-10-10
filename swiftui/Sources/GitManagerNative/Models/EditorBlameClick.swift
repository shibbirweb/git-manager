// A click on the blame gutter (src/lib/editor/blame.ts openBlame): the commit opens in the Log on the same line of
// its version of the file, and Option-click copies its hash. An uncommitted line shows the Changes panel in the
// current app; the native app always shows it.

import AppKit
import NativeCore

extension EditorModel {
    func blameClicked(line: Int, copyHash: Bool) async {
        guard let session, let blame = session.blame, let repoPath = context.app.repoPath,
              blame.lines.indices.contains(line), blame.lines[line] >= 0,
              let commit = blame.commit(atLine: line), !commit.uncommitted else {
            return
        }
        if copyHash {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(commit.id, forType: .string)
            context.toasts.show(.success, "Copied \(commit.shortId ?? String(commit.id.prefix(7)))")
            return
        }
        let doc = session.state.doc
        let docLine = doc.line(line)
        let target = blame.commitLineTarget(line, lineText: doc.slice(docLine.from, docLine.to))
        await context.log.focus(repoPath: repoPath, commitId: commit.id, filePath: session.file.relativePath,
                                line: target.line, lineText: target.lineText)
    }

    /// The gutter's tooltip on 0-based `line` (describe's title); nil past the blame.
    func blameTooltip(line: Int) -> String? {
        guard let blame = session?.blame, blame.lines.indices.contains(line) else {
            return nil
        }
        return BlameNote.tooltip(blame.lines[line] < 0 ? nil : blame.commit(atLine: line))
    }
}
