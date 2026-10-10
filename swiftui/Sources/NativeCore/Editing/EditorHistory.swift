// The undo history, ported from CodeMirror's history() (@codemirror/commands): each event stores the inverted
// changes and the selection before them; typing and deleting next to the previous edit within 500 ms join its
// event; selection moves are kept on the last event so a later edit starts a new one. Undo restores the selection
// from before the event, redo the one after it.

import Foundation

public struct EditorHistory: Sendable {
    struct Event: Sendable {
        /// The changes that undo this event (nil for an event that only holds selections).
        var changes: ChangeSet?
        var startSelection: EditorSelection?
        var selectionsAfter: [EditorSelection]

        static func from(_ transaction: Transaction, selection: EditorSelection? = nil) -> Event? {
            guard transaction.docChanged else {
                return nil
            }
            return Event(changes: transaction.changes.invert(transaction.startState.doc),
                         startSelection: selection ?? transaction.startState.selection, selectionsAfter: [])
        }
    }

    enum Side: Sendable {
        case done, undone
    }

    /// What an undo or redo takes off its branch, for the transaction that applies it.
    struct Pop: Sendable {
        let side: Side
        let rest: [Event]
        let selection: EditorSelection
    }

    static let minDepth = 100
    static let newGroupDelay = 500.0
    static let maxSelectionsPerEvent = 200

    var done: [Event] = []
    var undone: [Event] = []
    var prevTime = 0.0
    var prevUserEvent: String?

    public init() {}

    /// Undoable change events (undoDepth).
    public var undoDepth: Int {
        done.count - (done.first.map { $0.changes == nil ? 1 : 0 } ?? 0)
    }

    public var redoDepth: Int {
        undone.count - (undone.first.map { $0.changes == nil ? 1 : 0 } ?? 0)
    }

    func update(_ transaction: Transaction, addToHistory: Bool, fromHistory: Pop?) -> EditorHistory {
        if let fromHistory {
            let item = Event.from(transaction, selection: fromHistory.selection)
            var other = fromHistory.side == .done ? undone : done
            if let item {
                other = Self.updateBranch(other, to: other.count, maxLength: Self.minDepth, item)
            } else {
                other = Self.addSelection(other, transaction.startState.selection)
            }
            var result = EditorHistory()
            result.done = fromHistory.side == .done ? fromHistory.rest : other
            result.undone = fromHistory.side == .done ? other : fromHistory.rest
            return result
        }
        if !addToHistory {
            return self
        }
        if let event = Event.from(transaction) {
            return addChanges(event, time: transaction.time, userEvent: transaction.userEvent)
        }
        if transaction.selection != nil {
            return addSelection(transaction.startState.selection, time: transaction.time,
                                userEvent: transaction.userEvent)
        }
        return self
    }

    private func addChanges(_ event: Event, time: Double, userEvent: String?) -> EditorHistory {
        var result = self
        if let last = done.last, let lastChanges = last.changes, !lastChanges.isEmpty, let changes = event.changes,
           userEvent.map(Self.joinable) ?? true,
           (last.selectionsAfter.isEmpty && time - prevTime < Self.newGroupDelay
                && Self.isAdjacent(lastChanges, changes)) || userEvent == "input.type.compose" {
            let joined = Event(changes: changes.compose(lastChanges), startSelection: last.startSelection,
                               selectionsAfter: [])
            result.done = Self.updateBranch(done, to: done.count - 1, maxLength: Self.minDepth, joined)
        } else {
            result.done = Self.updateBranch(done, to: done.count, maxLength: Self.minDepth, event)
        }
        result.undone = []
        result.prevTime = time
        result.prevUserEvent = userEvent
        return result
    }

    private func addSelection(_ selection: EditorSelection, time: Double, userEvent: String?) -> EditorHistory {
        let last = done.last?.selectionsAfter ?? []
        if let previous = last.last, time - prevTime < Self.newGroupDelay, userEvent == prevUserEvent,
           let userEvent, userEvent == "select" || userEvent.hasPrefix("select."),
           previous.ranges.count == selection.ranges.count,
           zip(previous.ranges, selection.ranges).allSatisfy({ $0.isEmpty == $1.isEmpty }) {
            return self
        }
        var result = self
        result.done = Self.addSelection(done, selection)
        result.prevTime = time
        result.prevUserEvent = userEvent
        return result
    }

    static func joinable(_ userEvent: String) -> Bool {
        ["input.type", "delete"].contains { userEvent == $0 || userEvent.hasPrefix($0 + ".") }
    }

    static func updateBranch(_ branch: [Event], to end: Int, maxLength: Int, _ event: Event) -> [Event] {
        let start = end + 1 > maxLength + 20 ? end - maxLength - 1 : 0
        return Array(branch[start..<end]) + [event]
    }

    static func addSelection(_ branch: [Event], _ selection: EditorSelection) -> [Event] {
        guard var last = branch.last else {
            return [Event(changes: nil, startSelection: nil, selectionsAfter: [selection])]
        }
        var selections = Array(last.selectionsAfter.suffix(maxSelectionsPerEvent))
        if let previous = selections.last, previous.sameAs(selection) {
            return branch
        }
        selections.append(selection)
        last.selectionsAfter = selections
        return updateBranch(branch, to: branch.count - 1, maxLength: Int.max / 2, last)
    }

    /// Whether `second`'s changed ranges touch `first`'s, in the document between them (isAdjacent).
    static func isAdjacent(_ first: ChangeSet, _ second: ChangeSet) -> Bool {
        var ranges: [(Int, Int)] = []
        first.iterChanges { fromA, toA, _, _, _ in
            ranges.append((fromA, toA))
        }
        var adjacent = false
        second.iterChanges { _, _, fromB, toB, _ in
            if ranges.contains(where: { toB >= $0.0 && fromB <= $0.1 }) {
                adjacent = true
            }
        }
        return adjacent
    }

    /// The transaction spec for undo (`.done`) or redo (`.undone`), or nil when there is nothing to take.
    func pop(_ side: Side, state: EditorState, onlySelection: Bool) -> (TransactionSpec, Pop)? {
        let branch = side == .done ? done : undone
        guard let event = branch.last else {
            return nil
        }
        let selection = event.selectionsAfter.first
            ?? event.changes.flatMap { changes in event.startSelection?.map(changes.invertedDesc, assoc: 1) }
            ?? state.selection
        if onlySelection, let last = event.selectionsAfter.last {
            var rest = branch
            rest[rest.count - 1].selectionsAfter.removeLast()
            var spec = TransactionSpec(selection: last, userEvent: side == .done ? "select.undo" : "select.redo")
            spec.scrollIntoView = true
            return (spec, Pop(side: side, rest: rest, selection: selection))
        }
        guard let changes = event.changes else {
            return nil
        }
        let spec = TransactionSpec(changes: changes, selection: event.startSelection,
                                   userEvent: side == .done ? "undo" : "redo", scrollIntoView: true)
        return (spec, Pop(side: side, rest: Array(branch.dropLast()), selection: selection))
    }
}

extension EditorState {
    /// Undo (`selection` false) or undo a selection change too; nil when there is nothing to undo.
    public func undo(onlySelection: Bool = false, time: Double = Date().timeIntervalSince1970 * 1000)
        -> Transaction? {
        history.pop(.done, state: self, onlySelection: onlySelection)
            .map { update($0.0, time: time, history: $0.1) }
    }

    public func redo(onlySelection: Bool = false, time: Double = Date().timeIntervalSince1970 * 1000)
        -> Transaction? {
        history.pop(.undone, state: self, onlySelection: onlySelection)
            .map { update($0.0, time: time, history: $0.1) }
    }
}
