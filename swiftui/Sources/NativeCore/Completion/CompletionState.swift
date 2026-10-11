// The completion popup's state (@codemirror/autocomplete's CompletionState and CompletionDialog): the sources'
// states and, while it is open, the sorted options, the selected one, where the popup is anchored and when it
// opened. `update` takes each editor transaction (and completion's own effects) as the page's state field does.

import Foundation

public struct CompletionDialog: Equatable, Sendable {
    public let options: [CompletionOption]
    public let selected: Int
    /// The document position the popup is anchored at (the earliest result start).
    public let pos: Int
    /// When it first opened, in milliseconds (keys are ignored for the first 75).
    public let timestamp: Double
    /// Waiting for a source: the page keeps showing the old options.
    public let disabled: Bool

    func setSelected(_ index: Int) -> CompletionDialog {
        if index == selected || index >= options.count {
            return self
        }
        return CompletionDialog(options: options, selected: index, pos: pos, timestamp: timestamp, disabled: disabled)
    }

    func setDisabled() -> CompletionDialog {
        CompletionDialog(options: options, selected: selected, pos: pos, timestamp: timestamp, disabled: true)
    }

    func map(_ changes: ChangeSet) -> CompletionDialog {
        CompletionDialog(options: options, selected: selected, pos: changes.map(pos), timestamp: timestamp,
                         disabled: disabled)
    }

    static func build(_ active: [ActiveCompletion], state: EditorState, previous: CompletionDialog?,
                      didSetActive: Bool, now: Double) -> CompletionDialog? {
        if let previous, !didSetActive, active.contains(where: \.isPending) {
            return previous.setDisabled()
        }
        let options = CompletionSort.options(active.compactMap { entry in
            entry.result.map {
                CompletionSort.Active(source: entry.source, result: $0, typed: state.sliceDoc(entry.from, entry.to),
                                      resultID: entry.resultID)
            }
        })
        if options.isEmpty {
            return previous != nil && active.contains(where: \.isPending) ? previous?.setDisabled() : nil
        }
        var selected = 0
        if let previous, previous.selected != selected, previous.selected != -1 {
            let value = previous.options[previous.selected]
            if let index = options.firstIndex(where: { $0.sameCompletion(value) }) {
                selected = index
            }
        }
        let pos = active.filter(\.hasResult).map(\.from).min() ?? 100_000_000
        return CompletionDialog(options: options, selected: selected, pos: pos,
                                timestamp: previous?.timestamp ?? now, disabled: false)
    }
}

public struct CompletionState: Equatable, Sendable {
    public private(set) var active: [ActiveCompletion] = []
    public private(set) var open: CompletionDialog?
    /// The sources' ids in the order the page asks them: the words, then the language's (JavaScriptCore).
    public var sources: [Int]
    public var activateOnTyping: Bool

    public init(sources: [Int], activateOnTyping: Bool = true) {
        self.sources = sources
        self.activateOnTyping = activateOnTyping
    }

    /// The state after a transaction (nil for effects alone) and completion effects; `state` is the editor's new
    /// state, `now` the time in milliseconds.
    public func update(_ transaction: Transaction?, effects: [CompletionEffect] = [], state: EditorState,
                       now: Double) -> CompletionState {
        var next = self
        let anyActive = active.contains { $0.phase != .inactive }
        var newActive = sources.map { source in
            (active.first { $0.source == source }
                ?? ActiveCompletion(source: source, phase: anyActive ? .pending : .inactive))
                .update(transaction, effects: effects, activateOnTyping: activateOnTyping)
        }
        var open = self.open
        let didSet = effects.contains { if case .setActive = $0 { return true } else { return false } }
        if let changes = transaction?.changes, !changes.isEmpty {
            open = open?.map(changes)
        }
        let touched = transaction.map { tr in
            newActive.contains { $0.hasResult && tr.changes.touchesRange($0.from, $0.to) }
        } ?? false
        if transaction?.selection != nil || touched || !Self.sameResults(newActive, active) || didSet {
            open = CompletionDialog.build(newActive, state: state, previous: open, didSetActive: didSet, now: now)
        } else if let current = open, current.disabled, !newActive.contains(where: \.isPending) {
            open = nil
        }
        if open == nil && !newActive.contains(where: \.isPending) && newActive.contains(where: \.hasResult) {
            newActive = newActive.map { $0.hasResult ? ActiveCompletion(source: $0.source, phase: .inactive) : $0 }
        }
        for effect in effects {
            if case .setSelected(let index) = effect {
                open = open?.setSelected(index)
            }
        }
        next.active = newActive
        next.open = open
        return next
    }

    /// Whether both lists hold the same results in the same order (the page compares result objects).
    static func sameResults(_ one: [ActiveCompletion], _ two: [ActiveCompletion]) -> Bool {
        one.filter(\.hasResult).map(\.resultID) == two.filter(\.hasResult).map(\.resultID)
    }

    /// Whether any source is asked or answering (closeCompletion has something to close).
    public var isActive: Bool {
        active.contains { $0.phase != .inactive }
    }

    /// The source states that wait for a query.
    public var pending: [ActiveCompletion] {
        active.filter(\.isPending)
    }
}
