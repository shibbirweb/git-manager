// Which merge screen shows (repoStore.conflictsOpen and mergeTarget in the current app): the conflicts list, the
// merge tool over the window for one file, or, started by git mergetool, the merge tool alone. Saving follows
// MergeView.svelte (the result written and staged, then "Resolved <path>") and MergeToolApp.svelte (MERGED written,
// then the app quits with status 0; Cancel quits with 1 so git keeps the file unresolved).

import AppKit
import NativeCore

@MainActor
final class MergeCenter: ObservableObject {
    /// The window this belongs to (WindowContext).
    weak var context: WindowContext!

    @Published var conflictsOpen = false
    /// The repository-relative path in the merge tool, nil when it is closed.
    @Published private(set) var mergePath: String?
    @Published private(set) var session: MergeSession?
    @Published private(set) var loadError: String?
    /// Set when git mergetool started the app with its four files.
    let mergetool = MergetoolFiles.fromLaunch()
    /// Ignore whitespace differences when comparing (settings.ignoreWhitespace in the current app; kept for the run).
    private var ignoreWhitespace = false

    func openConflicts() {
        conflictsOpen = true
    }

    func openMerge(_ conflictPath: String) async {
        guard let repoPath = context.app.repoPath else {
            return
        }
        mergePath = conflictPath
        session = nil
        loadError = nil
        let args = LoadConflictArgs(repoPath: repoPath, conflictPath: conflictPath, ignoreWhitespace: ignoreWhitespace)
        let result = await Task.detached { () -> Result<MergeDocumentDTO, Error> in
            Result { try Backend.call("load_conflict", args) }
        }.value
        guard mergePath == conflictPath else {
            return
        }
        switch result {
        case .success(let document):
            session = MergeSession(document: document)
        case .failure(let error):
            loadError = AppModel.describe(error)
        }
    }

    func loadMergetool() async {
        guard var files = mergetool else {
            return
        }
        files.ignoreWhitespace = ignoreWhitespace
        let result = await Task.detached { () -> Result<MergeDocumentDTO, Error> in
            Result { try Backend.call("load_mergetool", files) }
        }.value
        switch result {
        case .success(let document):
            mergePath = document.path
            session = MergeSession(document: document)
        case .failure(let error):
            loadError = AppModel.describe(error)
        }
    }

    /// The toolbar's Ignore whitespace: the differences are computed again, which drops edits (asked first).
    func toggleWhitespace() {
        if let session, session.canUndo, !confirm(
            title: "Reload Merge",
            message: "Changing the whitespace mode recomputes the differences and discards your changes.",
            button: "Reload"
        ) {
            return
        }
        ignoreWhitespace.toggle()
        Task {
            if mergetool != nil {
                await loadMergetool()
            } else if let mergePath {
                await openMerge(mergePath)
            }
        }
    }

    func closeMerge() {
        mergePath = nil
        session = nil
        loadError = nil
    }

    /// Apply: asks about open chunks and leftover markers first (unless the whole file was just taken from a
    /// side), then saves.
    func apply(skipChecks: Bool = false) {
        guard let session, !session.saving else {
            return
        }
        let content = session.resultText
        if !skipChecks && !confirmSave(session.counts, content: content) {
            return
        }
        session.saving = true
        Task {
            await save(content, session: session)
            session.saving = false
        }
    }

    private func save(_ content: String, session: MergeSession) async {
        let eol = session.document.eol
        if let files = mergetool {
            let args = SaveMergetoolArgs(mergedPath: files.mergedPath, content: content, eol: eol)
            do {
                try Backend.perform("save_mergetool", args)
                exit(0)
            } catch {
                context.toasts.show(.error, "Could not save the merge result", detail: AppModel.describe(error))
            }
            return
        }
        guard let conflictPath = mergePath else {
            return
        }
        let saved = await context.app.run("Save resolution", success: "Resolved \(conflictPath)") { repoPath in
            try Backend.perform("save_resolution", SaveResolutionArgs(
                repoPath: repoPath, conflictPath: conflictPath, content: content, eol: eol
            ))
            return true
        }
        if saved == true {
            closeMerge()
        }
    }

    /// Cancel, Esc and the close button: an edited result is dropped only after asking.
    func cancel() {
        if let session, session.canUndo, !confirm(
            title: "Discard Changes", message: "Close the merge window and discard your changes to the result?",
            button: "Discard"
        ) {
            return
        }
        if mergetool != nil {
            exit(1)
        }
        closeMerge()
    }

    private func confirmSave(_ open: ResolutionCounts, content: String) -> Bool {
        if open.changes > 0 {
            let conflicts = open.conflicts > 0
                ? ", including \(open.conflicts) \(open.conflicts == 1 ? "conflict" : "conflicts")" : ""
            let message = "\(open.changes) \(open.changes == 1 ? "change is" : "changes are") still unresolved"
                + "\(conflicts). Save the result as it is and mark the file resolved?"
            if !confirm(title: "Unresolved Changes", message: message, button: "Save Anyway") {
                return false
            }
        }
        if MergeText.hasConflictMarkers(content) {
            let message = "The result still contains conflict markers (<<<<<<<, =======, >>>>>>>). Save anyway?"
            return confirm(title: "Conflict Markers Found", message: message, button: "Save Anyway")
        }
        return true
    }

    private func confirm(title: String, message: String, button: String) -> Bool {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: button)
        alert.addButton(withTitle: "Cancel")
        return alert.runModal() == .alertFirstButtonReturn
    }
}
