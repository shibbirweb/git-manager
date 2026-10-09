// The editor's tabs and the file the main area shows (src/lib/stores/tabs.ts and FileView.svelte): a click on a file
// in the Files panel opens it in the preview tab, a double click or `app action=open_file` keeps it. Only the
// active tab's text is in memory; another tab reads its file again when it comes back, as the current app keeps no
// text for tabs it does not show. A tab with unsaved edits keeps its session (and its dot) until saved or closed.

import Foundation
import NativeCore

@MainActor
final class EditorModel: ObservableObject {
    static let shared = EditorModel()

    @Published private(set) var tabs = EditorTabs()
    /// The active tab's editing session once its file is read; nil while it loads or when no tab is open.
    @Published private(set) var session: EditorSession?
    /// Bumps whenever the session's text, selection or marks change, so the views around the editor follow.
    @Published private(set) var revision = 0
    /// The diff tab is on screen (a click on a changed file), not a file tab.
    @Published var diffActive = false
    /// Why the active file shows no text ("Binary file"), or nil.
    @Published private(set) var message: String?
    /// Sessions of tabs with unsaved edits that are not on screen.
    private var parked: [String: EditorSession] = [:]

    private var repoPath: String? {
        AppModel.shared.repoPath
    }

    var file: OpenFile? {
        session?.file
    }

    /// Paths of the tabs with unsaved edits (the tab strip's dot).
    var dirtyPaths: Set<String> {
        var paths = Set(parked.keys)
        if let session, session.dirty {
            paths.insert(session.file.path)
        }
        return paths
    }

    /// Opens `absolutePath` in a tab and shows it; `pin` keeps it open (no preview tab).
    func open(_ absolutePath: String, pin: Bool) async {
        tabs.open(absolutePath, pin: pin)
        diffActive = false
        if session?.file.path != absolutePath {
            await load(absolutePath)
        }
    }

    func keep(_ absolutePath: String) {
        tabs.keep(absolutePath)
    }

    func activate(_ absolutePath: String) async {
        tabs.activate(absolutePath)
        diffActive = false
        if session?.file.path != absolutePath {
            await load(absolutePath)
        }
    }

    func close(_ absolutePath: String) async {
        tabs.close([absolutePath])
        parked[absolutePath] = nil
        if session?.file.path == absolutePath {
            session?.cancelTasks()
            session = nil
        }
        guard let active = tabs.active else {
            return
        }
        if session?.file.path != active {
            await load(active)
        }
    }

    /// Forgets every tab, as a new folder opens with none.
    func reset() {
        tabs = EditorTabs()
        session?.cancelTasks()
        session = nil
        parked = [:]
        diffActive = false
    }

    func relativePath(_ absolutePath: String) -> String {
        guard let repoPath, absolutePath.hasPrefix(repoPath + "/") else {
            return absolutePath
        }
        return String(absolutePath.dropFirst(repoPath.count + 1))
    }

    /// Reads the file off the main thread (or takes its unsaved session back), shows it, then adds its syntax
    /// colors, fold ranges, blame and change marks as they come.
    private func load(_ absolutePath: String) async {
        if let current = session, current.dirty {
            parked[current.file.path] = current
        }
        if let kept = parked.removeValue(forKey: absolutePath) {
            show(kept)
            return
        }
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
            session = nil
            message = error.message
            return
        case .success(let content) where content.binary || content.tooLarge:
            session = nil
            message = content.binary ? "Binary file, not shown." : "This file is too large to open here."
            return
        case .success(let content):
            message = nil
            show(EditorSession(file: OpenFile(path: absolutePath, relativePath: relative, content: content)))
        }
        guard let session, session.file.path == absolutePath else {
            return
        }
        await session.refreshSyntax()
        await loadBlame(session)
        await session.refreshMarks()
    }

    private func show(_ next: EditorSession) {
        session?.cancelTasks()
        session = next
        next.changed = { [weak self, weak next] _ in
            guard let self, let next, self.session === next else {
                return
            }
            self.revision += 1
        }
        revision += 1
    }

    /// Blames the text on screen; git cannot blame an untracked file, so every line of it reads as uncommitted.
    func loadBlame(_ target: EditorSession) async {
        guard let repoPath else {
            return
        }
        let doc = target.state.doc
        let args = BlameContentsArgs(repoPath: repoPath, filePath: target.file.relativePath,
                                     eol: target.file.content.eol, text: doc.string)
        let blame = await Task.detached { () -> BlameRuns in
            (try? Backend.call("blame_contents", args) as BlameRuns) ?? BlameRuns(commits: [], runs: [])
        }.value
        if target.state.doc.sameText(doc) {
            target.blame = BlameLines(blame, lineCount: doc.lineCount)
            target.markSaved(target.baseline)
        }
    }

    /// The main cursor line's blame note, or nil before the blame is known.
    var blameLabel: String? {
        guard let session, let blame = session.blame else {
            return nil
        }
        let line = session.state.doc.lineAt(session.state.selection.main.head).index
        return BlameNote.label(blame.commit(atLine: line))
    }

    /// File > Save (Cmd+S): writes the text in the file's own line endings, then refreshes git's view of it.
    @discardableResult
    func save() async -> Bool {
        guard let session, session.dirty, let repoPath else {
            return false
        }
        let doc = session.state.doc
        let args = WriteWorktreeFileArgs(repoPath: repoPath, filePath: session.file.relativePath, content: doc.string,
                                         eol: session.file.content.eol)
        let written = await Task.detached { () -> Bool in
            (try? Backend.call("write_worktree_file", args) as String) != nil
        }.value
        guard written else {
            ToastCenter.shared.show(.error, "Could not save \(session.file.relativePath)")
            return false
        }
        session.markSaved(doc)
        await AppModel.shared.refreshStatus()
        await loadBlame(session)
        await session.refreshMarks()
        return true
    }
}
