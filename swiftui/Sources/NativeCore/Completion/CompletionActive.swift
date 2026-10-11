// One completion source's state (@codemirror/autocomplete's ActiveSource and ActiveResult): inactive, pending (to
// be asked) or holding a result with the range it completes. Each transaction moves it along as the page's does:
// typing keeps a result while the typed text still fits its validFor, backspacing past its start drops it, a
// cursor move resets it, and typing makes an inactive source pending when completion runs on typing.

import Foundation

/// What a transaction means to completion (getUpdateType's bits).
public struct CompletionUpdate: OptionSet, Sendable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let typing = CompletionUpdate(rawValue: 1)
    public static let backspacing = CompletionUpdate(rawValue: 2)
    public static let activate = CompletionUpdate(rawValue: 4)
    public static let reset = CompletionUpdate(rawValue: 8)
    public static let resetIfTouching = CompletionUpdate(rawValue: 16)
    public static let simpleInteraction: CompletionUpdate = [.typing, .backspacing]

    public static func of(_ transaction: Transaction, activateOnTyping: Bool) -> CompletionUpdate {
        let typing = transaction.isUserEvent("input.type")
        if typing {
            return activateOnTyping ? [.activate, .typing] : .typing
        }
        if transaction.isUserEvent("delete.backward") {
            return .backspacing
        }
        if transaction.selection != nil {
            return .reset
        }
        return transaction.docChanged ? .resetIfTouching : []
    }
}

public enum CompletionEffect: Equatable, Sendable {
    /// startCompletionEffect: true when asked for (Ctrl+Space), false after an input method's composition.
    case start(explicit: Bool)
    case close
    case setSelected(Int)
    /// setActiveEffect: finished queries' new states.
    case setActive([ActiveCompletion])
}

public struct ActiveCompletion: Equatable, Sendable {
    public enum Phase: Equatable, Sendable {
        case inactive, pending, result
    }

    public let source: Int
    public let phase: Phase
    public let explicit: Bool
    /// With a result: the position before which backspacing drops it, the result, the range it completes and an
    /// identity number for the result (the page compares result objects).
    public let limit: Int
    public let result: CompletionResult?
    public let from: Int
    public let to: Int
    public let resultID: Int

    public init(source: Int, phase: Phase, explicit: Bool = false) {
        self.source = source
        self.phase = phase
        self.explicit = explicit
        limit = 0
        result = nil
        from = 0
        to = 0
        resultID = 0
    }

    public init(source: Int, explicit: Bool, limit: Int, result: CompletionResult, from: Int, to: Int,
                resultID: Int) {
        self.source = source
        phase = .result
        self.explicit = explicit
        self.limit = limit
        self.result = result
        self.from = from
        self.to = to
        self.resultID = resultID
    }

    public var hasResult: Bool {
        phase == .result
    }

    public var isPending: Bool {
        phase == .pending
    }

    public func update(_ transaction: Transaction?, effects: [CompletionEffect], activateOnTyping: Bool)
        -> ActiveCompletion {
        var value = self
        if let transaction {
            let type = CompletionUpdate.of(transaction, activateOnTyping: activateOnTyping)
            if type.contains(.reset) || type.contains(.resetIfTouching) && value.touches(transaction) {
                value = ActiveCompletion(source: source, phase: .inactive)
            }
            if type.contains(.activate) && value.phase == .inactive {
                value = ActiveCompletion(source: source, phase: .pending)
            }
            value = value.updateFor(transaction, type)
        }
        for effect in effects {
            switch effect {
            case .start(let explicit):
                value = ActiveCompletion(source: value.source, phase: .pending, explicit: explicit)
            case .close:
                value = ActiveCompletion(source: value.source, phase: .inactive)
            case .setActive(let list):
                for active in list where active.source == value.source {
                    value = active
                }
            case .setSelected:
                break
            }
        }
        return value
    }

    func updateFor(_ transaction: Transaction, _ type: CompletionUpdate) -> ActiveCompletion {
        guard hasResult, let result else {
            return self
        }
        if type.intersection(.simpleInteraction).isEmpty {
            return map(transaction.changes)
        }
        let changes = transaction.changes
        let newFrom = changes.map(from), newTo = changes.map(to, assoc: 1)
        let pos = transaction.state.selection.main.from
        if pos > newTo || type.contains(.backspacing)
            && (transaction.startState.selection.main.from == from || pos < limit) {
            return ActiveCompletion(source: source, phase: type.contains(.activate) ? .pending : .inactive)
        }
        let newLimit = changes.map(limit)
        if let validFor = result.validFor, validFor.test(transaction.state.sliceDoc(newFrom, newTo)) {
            return ActiveCompletion(source: source, explicit: explicit, limit: newLimit, result: result,
                                    from: newFrom, to: newTo, resultID: resultID)
        }
        return ActiveCompletion(source: source, phase: .pending, explicit: explicit)
    }

    public func map(_ changes: ChangeSet) -> ActiveCompletion {
        guard hasResult, let result, !changes.isEmpty else {
            return self
        }
        return ActiveCompletion(source: source, explicit: explicit, limit: changes.map(limit), result: result,
                                from: changes.map(from), to: changes.map(to, assoc: 1), resultID: resultID)
    }

    func touches(_ transaction: Transaction) -> Bool {
        if hasResult {
            return transaction.changes.touchesRange(from, to)
        }
        return transaction.changes.touchesRange(transaction.state.selection.main.from)
    }
}
