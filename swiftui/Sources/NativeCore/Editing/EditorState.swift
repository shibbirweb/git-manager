// The editor's state, a small CodeMirror EditorState: the document, the selection, the configuration (indent unit,
// tab size, language data) and the fields the current app's extensions keep (the undo history, the folded ranges,
// the brackets closeBrackets inserted). Every change goes through `update`, which returns the transaction and the
// new state, so commands stay pure and testable.

import Foundation

public enum EditorEffect: Equatable, Sendable {
    case fold(from: Int, to: Int)
    case unfold(from: Int, to: Int)
    /// closeBrackets inserted the bracket at this position (closeBracketEffect).
    case closeBracket(Int)

    func mapped(_ changes: ChangeSet) -> EditorEffect? {
        switch self {
        case .fold(let from, let to), .unfold(let from, let to):
            let newFrom = changes.map(from, assoc: 1), newTo = changes.map(to, assoc: -1)
            guard newFrom < newTo else {
                return nil
            }
            if case .fold = self {
                return .fold(from: newFrom, to: newTo)
            }
            return .unfold(from: newFrom, to: newTo)
        case .closeBracket(let position):
            return changes.mapPos(position, assoc: -1, mode: .trackAfter).map { .closeBracket($0) }
        }
    }
}

public struct EditorConfig: Sendable {
    public var tabSize: Int
    /// One level of indentation: spaces or a tab.
    public var indentUnit: String
    public var language: LanguageData

    public init(tabSize: Int = 4, indentUnit: String = "    ", language: LanguageData = LanguageData()) {
        self.tabSize = tabSize
        self.indentUnit = indentUnit
        self.language = language
    }

    /// The unit's width in columns.
    public var indentWidth: Int {
        indentUnit == "\t" ? tabSize : indentUnit.count
    }
}

public struct TransactionSpec: Sendable {
    /// Changes in the start document.
    public var changes: ChangeSet?
    /// The new selection, in the changed document; without one the old selection is mapped.
    public var selection: EditorSelection?
    public var effects: [EditorEffect] = []
    public var userEvent: String?
    public var scrollIntoView = false
    public var addToHistory = true

    public init(
        changes: ChangeSet? = nil, selection: EditorSelection? = nil, effects: [EditorEffect] = [],
        userEvent: String? = nil, scrollIntoView: Bool = false
    ) {
        self.changes = changes
        self.selection = selection
        self.effects = effects
        self.userEvent = userEvent
        self.scrollIntoView = scrollIntoView
    }
}

public struct Transaction: Sendable {
    public let startState: EditorState
    public let changes: ChangeSet
    public let selection: EditorSelection?
    public let effects: [EditorEffect]
    public let userEvent: String?
    public let scrollIntoView: Bool
    public let time: Double
    public internal(set) var state: EditorState

    public var docChanged: Bool {
        !changes.isEmpty
    }

    /// CodeMirror's isUserEvent: the event or one of its sub-events ("input" matches "input.type").
    public func isUserEvent(_ event: String) -> Bool {
        guard let userEvent else {
            return false
        }
        return userEvent == event || userEvent.hasPrefix(event + ".")
    }
}

public struct EditorState: Sendable {
    public internal(set) var doc: TextDocument
    public internal(set) var selection: EditorSelection
    public var config: EditorConfig
    public internal(set) var history = EditorHistory()
    /// Folded ranges, sorted by start.
    public internal(set) var folds: [CodeFold] = []
    /// Positions of closing brackets closeBrackets inserted (skipped over when typed).
    public internal(set) var closedBrackets: [Int] = []

    public init(doc: TextDocument, selection: EditorSelection = .single(0), config: EditorConfig = EditorConfig()) {
        self.doc = doc
        self.selection = selection.clamped(to: doc.length)
        self.config = config
    }

    // MARK: - Reading

    public func sliceDoc(_ from: Int, _ to: Int) -> String {
        doc.slice(from, to)
    }

    public func category(_ character: String) -> CharCategory {
        TextUnits.category(character, wordChars: config.language.wordUnits)
    }

    /// The word around `position`, or nil (EditorState.wordAt).
    public func wordAt(_ position: Int) -> SelectionRange? {
        let line = doc.lineAt(position)
        var start = position - line.from, end = start
        while start > 0 {
            let previous = TextUnits.clusterBreak(line.text, start, forward: false)
            if category(TextDocument.utf16Slice(line.text, previous, start)) != .word {
                break
            }
            start = previous
        }
        while end < line.length {
            let next = TextUnits.clusterBreak(line.text, end)
            if category(TextDocument.utf16Slice(line.text, end, next)) != .word {
                break
            }
            end = next
        }
        return start == end ? nil : .range(start + line.from, end + line.from)
    }

    public func changes(_ specs: [ChangeSpec]) -> ChangeSet {
        ChangeSet.of(specs, length: doc.length)
    }

    // MARK: - Building transactions

    public struct RangeChange {
        public var changes: [ChangeSpec]
        public var range: SelectionRange
        public var effects: [EditorEffect]

        public init(changes: [ChangeSpec] = [], range: SelectionRange, effects: [EditorEffect] = []) {
            self.changes = changes
            self.range = range
            self.effects = effects
        }
    }

    /// CodeMirror's changeByRange: `body` gives each range's changes (in this document) and its new range (in the
    /// document after only its own changes); the result maps them all into one transaction.
    public func changeByRange(_ body: (SelectionRange) -> RangeChange) -> TransactionSpec {
        let ranges = selection.ranges
        let first = body(ranges[0])
        var changes = self.changes(first.changes)
        var newRanges = [first.range]
        var effects = first.effects
        for index in 1..<max(1, ranges.count) {
            let result = body(ranges[index])
            let newChanges = self.changes(result.changes), newMapped = newChanges.map(changes)
            for earlier in 0..<index {
                newRanges[earlier] = newRanges[earlier].map(newMapped)
            }
            let mapBy = changes.map(newChanges, before: true)
            newRanges.append(result.range.map(mapBy))
            changes = changes.compose(newMapped)
            effects = effects.compactMap { $0.mapped(newMapped) } + result.effects.compactMap { $0.mapped(mapBy) }
        }
        return TransactionSpec(changes: changes, selection: EditorSelection(newRanges, mainIndex: selection.mainIndex),
                               effects: effects)
    }

    /// Replaces every range with `text`, the cursor after it (replaceSelection).
    public func replaceSelection(_ text: String) -> TransactionSpec {
        let length = text.utf16.count
        return changeByRange { range in
            RangeChange(changes: [ChangeSpec(from: range.from, to: range.to, insert: text)],
                        range: .cursor(range.from + length))
        }
    }

    // MARK: - Applying

    public func update(_ spec: TransactionSpec, time: Double = Date().timeIntervalSince1970 * 1000) -> Transaction {
        update(spec, time: time, history: nil)
    }

    func update(_ spec: TransactionSpec, time: Double, history fromHistory: EditorHistory.Pop?) -> Transaction {
        let changes = spec.changes ?? .empty(doc.length)
        var next = self
        next.doc = changes.isEmpty ? doc : changes.apply(to: doc)
        let mapped = spec.selection ?? selection.map(changes)
        next.selection = mapped.clamped(to: next.doc.length)
        var transaction = Transaction(
            startState: self, changes: changes, selection: spec.selection, effects: spec.effects,
            userEvent: spec.userEvent, scrollIntoView: spec.scrollIntoView, time: time, state: next
        )
        next.folds = FoldState.update(folds, transaction: transaction)
        next.closedBrackets = CloseBrackets.updateField(closedBrackets, transaction: transaction)
        next.history = history.update(transaction, addToHistory: spec.addToHistory, fromHistory: fromHistory)
        transaction.state = next
        return transaction
    }
}
