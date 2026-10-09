// One open file being edited (FileView.svelte's CodeMirror view and its listeners): the editing state (NativeCore),
// the text last saved, and what the editor shows beside the text: syntax colors and fold candidates from the
// current app's grammars, the blame by line, and the changes against HEAD. Edits move all of them along at once;
// the syntax pass runs again 150 ms after typing stops, the change marks 200 ms after (as scheduleMarks does).

import Foundation
import NativeCore

@MainActor
final class EditorSession {
    let file: OpenFile
    private(set) var state: EditorState
    /// The text on disk, as last read or saved; the tab shows the unsaved dot while the text differs.
    private(set) var baseline: TextDocument
    private(set) var dirty = false
    let style: IndentStyle
    var colors: SyntaxColors?
    var foldRanges = FoldRanges()
    var blame: BlameLines?
    var marks: [LineMark] = []
    /// The text of this editor's last linewise copy, so pasting it goes above the line.
    var lastLinewiseCopy: String?
    /// Bumps on every change of what the editor draws.
    private(set) var revision = 0
    /// Bumps when the text or the folds change (what the indent guides and rows follow).
    private(set) var docRevision = 0
    /// Bumps when the colors, fold ranges, marks or blame are replaced: the canvas paints everything again.
    private(set) var paintRevision = 0
    /// The lines the last edit touched (in the new text), for the canvas to paint only those rows.
    private(set) var lastEdit: (revision: Int, lines: ClosedRange<Int>, lineCountChanged: Bool)?
    /// Called after every change, with the transaction when there was one.
    var changed: (Transaction?) -> Void = { _ in }

    private var syntaxTask: Task<Void, Never>?
    private var marksTask: Task<Void, Never>?

    init(file: OpenFile) {
        self.file = file
        let doc = TextDocument(file.content.content)
        baseline = doc
        let language = EditorInfo.languageName(filePath: file.path)
        style = IndentRules.style(languageName: language)
        let indent = file.indent
        let size = indent?.size ?? EditorInfo.defaultTabSize
        let config = EditorConfig(tabSize: size,
                                  indentUnit: indent?.useTabs == true ? "\t" : String(repeating: " ", count: size),
                                  language: LanguageData.forLanguage(language))
        state = EditorState(doc: doc, config: config)
    }

    var context: EditorContext {
        EditorContext(style: style, foldRanges: foldRanges, pageRows: pageRows)
    }

    /// Rows a page holds; the canvas sets it from its height.
    var pageRows = 30

    func run(_ action: EditorAction) -> Bool {
        guard let transaction = EditorActions.run(action, state, context) else {
            return false
        }
        apply(transaction)
        return true
    }

    func dispatch(_ spec: TransactionSpec) {
        apply(state.update(spec))
    }

    func apply(_ transaction: Transaction) {
        let old = state
        state = transaction.state
        if transaction.docChanged || old.folds != state.folds {
            docRevision += 1
        }
        if transaction.docChanged {
            let changes = transaction.changes
            var first = Int.max, last = 0
            changes.iterChanges { _, _, fromB, toB, _ in
                first = min(first, state.doc.lineAt(fromB).index)
                last = max(last, state.doc.lineAt(toB).index)
            }
            lastEdit = (docRevision, first...max(first, last), old.doc.lineCount != state.doc.lineCount)
            colors = colors?.mapped(changes)
            foldRanges = foldRanges.mapped(changes)
            blame = blame?.mapped(changes, oldDoc: old.doc, newDoc: state.doc)
            dirty = !state.doc.sameText(baseline)
            scheduleSyntax()
            scheduleMarks()
        }
        revision += 1
        changed(transaction)
    }

    /// The saved text is now `doc` (after Save).
    func markSaved(_ doc: TextDocument) {
        baseline = doc
        dirty = !state.doc.sameText(baseline)
        paintRevision += 1
        revision += 1
        changed(nil)
    }

    func refreshSyntax() async {
        let text = state.doc.string, doc = state.doc
        let answer = await SyntaxHighlighter.shared.syntax(filePath: file.path, text: text)
        guard doc.sameText(state.doc) else {
            return
        }
        colors = answer.colors
        foldRanges = answer.folds
        paintRevision += 1
        revision += 1
        changed(nil)
    }

    private func scheduleSyntax() {
        syntaxTask?.cancel()
        syntaxTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else {
                return
            }
            await self?.refreshSyntax()
        }
    }

    private func scheduleMarks() {
        marksTask?.cancel()
        marksTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 200_000_000)
            guard !Task.isCancelled else {
                return
            }
            await self?.refreshMarks()
        }
    }

    /// The changes against HEAD for the text on screen (line_change_marks); a result for older text is dropped.
    func refreshMarks() async {
        guard let repoPath = AppModel.shared.repoPath else {
            return
        }
        let doc = state.doc
        let args = LineChangeMarksArgs(repoPath: repoPath, filePath: file.relativePath, origPath: nil, text: doc.string)
        let answer = await Task.detached { () -> LineMarksReply? in
            try? Backend.call("line_change_marks", args) as LineMarksReply
        }.value
        guard let answer, doc.sameText(state.doc) else {
            return
        }
        if answer.marks != marks {
            marks = answer.marks
            paintRevision += 1
            revision += 1
            changed(nil)
        }
    }

    func cancelTasks() {
        syntaxTask?.cancel()
        marksTask?.cancel()
    }
}

struct LineChangeMarksArgs: Encodable {
    let repoPath: String
    let filePath: String
    let origPath: String?
    let text: String
}

struct LineMarksReply: Decodable {
    let marks: [LineMark]
}

struct WriteWorktreeFileArgs: Encodable {
    let repoPath: String
    let filePath: String
    let content: String
    let eol: String
}
