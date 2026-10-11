// The fields of an inserted snippet (@codemirror/autocomplete's ActiveSnippet and snippetState): picking a snippet
// completion ("for", "function", "if" ...) selects its first field; Tab and Shift+Tab move between fields, Escape
// lets go, and so does moving the cursor out of the active field or deleting a field. Reaching the last field lets
// go as well. The fields come from the snippet's own code, run in JavaScriptCore when the option is picked.

import Foundation

public struct SnippetField: Equatable, Sendable {
    public let field: Int
    public let from: Int
    public let to: Int

    public init(field: Int, from: Int, to: Int) {
        self.field = field
        self.from = from
        self.to = to
    }

    func map(_ changes: ChangeSet) -> SnippetField? {
        guard let newFrom = changes.mapPos(from, assoc: -1, mode: .trackDel),
              let newTo = changes.mapPos(to, assoc: 1, mode: .trackDel) else {
            return nil
        }
        return SnippetField(field: field, from: newFrom, to: newTo)
    }
}

public struct ActiveSnippet: Equatable, Sendable {
    public let ranges: [SnippetField]
    public let active: Int

    public init(ranges: [SnippetField], active: Int) {
        self.ranges = ranges
        self.active = active
    }

    public func map(_ changes: ChangeSet) -> ActiveSnippet? {
        var mapped: [SnippetField] = []
        for range in ranges {
            guard let next = range.map(changes) else {
                return nil
            }
            mapped.append(next)
        }
        return ActiveSnippet(ranges: mapped, active: active)
    }

    public func selectionInsideField(_ selection: EditorSelection) -> Bool {
        selection.ranges.allSatisfy { range in
            ranges.contains { $0.field == active && $0.from <= range.from && $0.to >= range.to }
        }
    }

    /// snippetState's update for a transaction without a snippet effect.
    public static func follow(_ value: ActiveSnippet?, _ transaction: Transaction) -> ActiveSnippet? {
        var value = value
        if let current = value, transaction.docChanged {
            value = current.map(transaction.changes)
        }
        if let current = value, let selection = transaction.selection, !current.selectionInsideField(selection) {
            value = nil
        }
        return value
    }

    /// fieldSelection: every range of one field selected.
    public func selection(of field: Int) -> EditorSelection? {
        let picked = ranges.filter { $0.field == field }.map { SelectionRange.range($0.from, $0.to) }
        guard !picked.isEmpty else {
            return nil
        }
        return EditorSelection(picked, mainIndex: 0)
    }

    /// moveField: Tab (1) or Shift+Tab (-1): the selection and the snippet after it (nil when it lets go), or nil
    /// when there is no field that way.
    public func move(_ direction: Int) -> (selection: EditorSelection, snippet: ActiveSnippet?)? {
        if direction < 0 && active == 0 {
            return nil
        }
        let next = active + direction
        let last = direction > 0 && !ranges.contains { $0.field == next + direction }
        guard let selection = selection(of: next) else {
            return nil
        }
        return (selection, last ? nil : ActiveSnippet(ranges: ranges, active: next))
    }

    /// snippetPointerHandler: a click inside another field selects that field.
    public func click(at position: Int) -> (selection: EditorSelection, snippet: ActiveSnippet?)? {
        guard let match = ranges.first(where: { $0.from <= position && $0.to >= position }), match.field != active,
              let selection = selection(of: match.field) else {
            return nil
        }
        let keeps = ranges.contains { $0.field > match.field }
        return (selection, keeps ? ActiveSnippet(ranges: ranges, active: match.field) : nil)
    }
}

/// An edit a completion's apply function made in JavaScriptCore (a snippet): the changes in the document it
/// started from, the selection after them, and the snippet's fields when it has some to move through.
public struct CompletionEdit: Equatable, Sendable {
    public var changes: [ChangeSpec]
    public var selection: [SelectionRange]?
    public var mainIndex: Int
    public var fields: [SnippetField]?
    public var active: Int

    public init(changes: [ChangeSpec], selection: [SelectionRange]?, mainIndex: Int = 0,
                fields: [SnippetField]? = nil, active: Int = 0) {
        self.changes = changes
        self.selection = selection
        self.mainIndex = mainIndex
        self.fields = fields
        self.active = active
    }

    public func spec(_ state: EditorState) -> TransactionSpec {
        var spec = TransactionSpec(changes: state.changes(changes),
                                   selection: selection.map { EditorSelection($0, mainIndex: mainIndex) })
        spec.userEvent = "input.complete"
        spec.scrollIntoView = true
        return spec
    }

    /// The snippet state it starts (snippet() sets one only when there is a field after the first).
    public var snippet: ActiveSnippet? {
        guard let fields, fields.contains(where: { $0.field > 0 }) else {
            return nil
        }
        return ActiveSnippet(ranges: fields, active: active)
    }
}
