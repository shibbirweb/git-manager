// The editor's tabs and the file the main area shows (src/lib/stores/tabs.ts and FileView.svelte): a click on a file
// in the Files panel opens it in the preview tab, a double click or `app action=open_file` keeps it open. Only the
// active tab's text is in memory; another tab reads its file again when it comes back, as the current app keeps no
// text for tabs it does not show.

import Foundation
import NativeCore

@MainActor
final class EditorModel: ObservableObject {
    static let shared = EditorModel()

    @Published private(set) var tabs = EditorTabs()
    /// The active tab's file once read; nil while it loads or when no tab is open.
    @Published private(set) var file: OpenFile?
    /// The diff tab is on screen (a click on a changed file), not a file tab.
    @Published var diffActive = false
    /// Why the active file shows no text ("Binary file"), or nil.
    @Published private(set) var message: String?
    /// The cursor, 0-based line and UTF-16 column; the current app puts it at the start of a newly opened file.
    @Published var cursor = (line: 0, column: 0)

    private var repoPath: String? {
        AppModel.shared.repoPath
    }

    /// Opens `absolutePath` in a tab and shows it; `pin` keeps it open (no preview tab).
    func open(_ absolutePath: String, pin: Bool) async {
        tabs.open(absolutePath, pin: pin)
        diffActive = false
        await load(absolutePath)
    }

    func keep(_ absolutePath: String) {
        tabs.keep(absolutePath)
    }

    func activate(_ absolutePath: String) async {
        tabs.activate(absolutePath)
        diffActive = false
        if file?.path != absolutePath {
            await load(absolutePath)
        }
    }

    func close(_ absolutePath: String) async {
        tabs.close([absolutePath])
        guard let active = tabs.active else {
            file = nil
            return
        }
        if file?.path != active {
            await load(active)
        }
    }

    /// Forgets every tab, as a new folder opens with none.
    func reset() {
        tabs = EditorTabs()
        file = nil
        diffActive = false
    }

    func relativePath(_ absolutePath: String) -> String {
        guard let repoPath, absolutePath.hasPrefix(repoPath + "/") else {
            return absolutePath
        }
        return String(absolutePath.dropFirst(repoPath.count + 1))
    }

    /// Reads the file off the main thread, shows it, then adds its syntax colors and its blame as they come.
    private func load(_ absolutePath: String) async {
        guard let repoPath else {
            return
        }
        let relative = relativePath(absolutePath)
        let args = ReadWorktreeFileArgs(repoPath: repoPath, filePath: relative, knownVersion: nil)
        let read = await Task.detached { () -> Result<FileContent, BackendError> in
            do {
                return .success(try Backend.call("read_worktree_file", args) as FileContent)
            } catch let error as BackendError {
                return .failure(error)
            } catch {
                return .failure(BackendError(kind: "bridge", message: error.localizedDescription))
            }
        }.value
        guard tabs.active == absolutePath else {
            return
        }
        switch read {
        case .failure(let error):
            file = nil
            message = error.message
            return
        case .success(let content) where content.binary || content.tooLarge:
            file = nil
            message = content.binary ? "Binary file, not shown." : "This file is too large to open here."
            return
        case .success(let content):
            message = nil
            cursor = (0, 0)
            file = OpenFile(path: absolutePath, relativePath: relative, content: content)
        }
        guard let text = file?.content.content, let eol = file?.content.eol else {
            return
        }
        let spans = await SyntaxHighlighter.shared.spans(filePath: absolutePath, text: text)
        if file?.path == absolutePath {
            file?.spans = spans
        }
        let blameArgs = BlameContentsArgs(repoPath: repoPath, filePath: relative, eol: eol, text: text)
        // git cannot blame an untracked file: every line of it reads as uncommitted, as allUncommitted does.
        let blame = await Task.detached { () -> BlameRuns in
            (try? Backend.call("blame_contents", blameArgs) as BlameRuns) ?? BlameRuns(commits: [], runs: [])
        }.value
        if file?.path == absolutePath {
            file?.blame = blame
        }
    }

    /// The cursor line's blame note, or nil before the blame is known.
    var blameLabel: String? {
        guard let file, let blame = file.blame else {
            return nil
        }
        return BlameNote.label(BlameNote.commit(atLine: cursor.line, in: blame))
    }
}
