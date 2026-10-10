// A set of edits to a document, ported from CodeMirror's ChangeSet (@codemirror/state) so positions map, changes
// compose and undo inverts exactly as in the current app. Sections are pairs: a length in the old document, then
// -1 for an untouched stretch or the length of what replaces it. Lengths count UTF-16 units.

import Foundation

public struct ChangeSpec: Equatable, Sendable {
    public var from: Int
    public var to: Int
    public var insert: String

    public init(from: Int, to: Int? = nil, insert: String = "") {
        self.from = from
        self.to = to ?? from
        self.insert = insert
    }
}

public enum MapMode: Sendable {
    case simple, trackDel, trackBefore, trackAfter
}

public struct ChangeSet: Equatable, Sendable {
    public internal(set) var sections: [Int]
    /// The text each section inserts, by section index ("" where none).
    public internal(set) var inserted: [String]

    init(sections: [Int], inserted: [String]) {
        self.sections = sections
        self.inserted = inserted
    }

    public static func empty(_ length: Int) -> ChangeSet {
        ChangeSet(sections: length > 0 ? [length, -1] : [], inserted: [])
    }

    /// The document's length before the changes.
    public var length: Int {
        stride(from: 0, to: sections.count, by: 2).reduce(0) { $0 + sections[$1] }
    }

    /// The document's length after the changes.
    public var newLength: Int {
        stride(from: 0, to: sections.count, by: 2).reduce(0) { total, index in
            let ins = sections[index + 1]
            return total + (ins < 0 ? sections[index] : ins)
        }
    }

    public var isEmpty: Bool {
        sections.isEmpty || (sections.count == 2 && sections[1] < 0)
    }

    /// Builds the set for `changes` (positions in a document of `length`), as ChangeSet.of does: changes given out
    /// of order are mapped over the earlier ones.
    public static func of(_ changes: [ChangeSpec], length: Int) -> ChangeSet {
        var sections: [Int] = [], inserted: [String] = [], position = 0
        var total: ChangeSet?
        func flush(force: Bool = false) {
            if !force && sections.isEmpty {
                return
            }
            if position < length {
                addSection(&sections, length - position, -1)
            }
            let set = ChangeSet(sections: sections, inserted: inserted)
            total = total.map { $0.compose(set.map($0)) } ?? set
            sections = []
            inserted = []
            position = 0
        }
        for change in changes {
            let insertLength = change.insert.utf16.count
            if change.from == change.to && insertLength == 0 {
                continue
            }
            if change.from < position {
                flush()
            }
            if change.from > position {
                addSection(&sections, change.from - position, -1)
            }
            addSection(&sections, change.to - change.from, insertLength)
            addInsert(&inserted, sections, change.insert)
            position = change.to
        }
        flush(force: total == nil)
        return total ?? .empty(length)
    }

    // MARK: - Reading

    /// Calls `body(fromA, toA, fromB, toB, text)` for each changed range, adjacent changes joined unless
    /// `individual`.
    public func iterChanges(individual: Bool = false, _ body: (Int, Int, Int, Int, String) -> Void) {
        var posA = 0, posB = 0, index = 0
        while index < sections.count {
            var len = sections[index], ins = sections[index + 1]
            index += 2
            if ins < 0 {
                posA += len
                posB += len
                continue
            }
            var endA = posA, endB = posB, text = ""
            while true {
                endA += len
                endB += ins
                if ins > 0 {
                    text += insertedText((index - 2) / 2)
                }
                if individual || index == sections.count || sections[index + 1] < 0 {
                    break
                }
                len = sections[index]
                ins = sections[index + 1]
                index += 2
            }
            body(posA, endA, posB, endB, text)
            posA = endA
            posB = endB
        }
    }

    /// Calls `body(posA, posB, length)` for each untouched stretch.
    public func iterGaps(_ body: (Int, Int, Int) -> Void) {
        var posA = 0, posB = 0
        for index in stride(from: 0, to: sections.count, by: 2) {
            let len = sections[index], ins = sections[index + 1]
            if ins < 0 {
                body(posA, posB, len)
                posB += len
            } else {
                posB += ins
            }
            posA += len
        }
    }

    func insertedText(_ sectionIndex: Int) -> String {
        sectionIndex < inserted.count ? inserted[sectionIndex] : ""
    }

    /// Where `position` lands after the changes; nil only for the tracking modes when a deletion covers it.
    public func mapPos(_ position: Int, assoc: Int = -1, mode: MapMode = .simple) -> Int? {
        var posA = 0, posB = 0
        for index in stride(from: 0, to: sections.count, by: 2) {
            let len = sections[index], ins = sections[index + 1], endA = posA + len
            if ins < 0 {
                if endA > position {
                    return posB + (position - posA)
                }
                posB += len
            } else {
                if mode != .simple && endA >= position
                    && ((mode == .trackDel && posA < position && endA > position)
                        || (mode == .trackBefore && posA < position) || (mode == .trackAfter && endA > position)) {
                    return nil
                }
                if endA > position || (endA == position && assoc < 0 && len == 0) {
                    return position == posA || assoc < 0 ? posB : posB + ins
                }
                posB += ins
            }
            posA = endA
        }
        return posB
    }

    /// mapPos in the simple mode, which always has an answer.
    public func map(_ position: Int, assoc: Int = -1) -> Int {
        mapPos(position, assoc: assoc) ?? position
    }

    /// True when a change touches `from` to `to`.
    public func touchesRange(_ from: Int, _ to: Int? = nil) -> Bool {
        let end = to ?? from
        var position = 0
        for index in stride(from: 0, to: sections.count, by: 2) where position <= end {
            let len = sections[index], ins = sections[index + 1], sectionEnd = position + len
            if ins >= 0 && position <= end && sectionEnd >= from {
                return true
            }
            position = sectionEnd
        }
        return false
    }

    // MARK: - Applying

    public func apply(to document: TextDocument) -> TextDocument {
        var result = document
        iterChanges { fromA, toA, fromB, _, text in
            result.replace(fromB, fromB + (toA - fromA), with: text)
        }
        return result
    }

    /// The changes that undo these, given the document they started from.
    public func invert(_ document: TextDocument) -> ChangeSet {
        var newSections = sections, newInserted: [String] = []
        var position = 0
        for index in stride(from: 0, to: newSections.count, by: 2) {
            let len = newSections[index], ins = newSections[index + 1]
            if ins >= 0 {
                newSections[index] = ins
                newSections[index + 1] = len
                while newInserted.count < index / 2 {
                    newInserted.append("")
                }
                newInserted.append(len > 0 ? document.slice(position, position + len) : "")
            }
            position += len
        }
        return ChangeSet(sections: newSections, inserted: newInserted)
    }

    /// The description of the inverted changes (no text).
    public var invertedDesc: ChangeSet {
        var result: [Int] = []
        for index in stride(from: 0, to: sections.count, by: 2) {
            let len = sections[index], ins = sections[index + 1]
            result.append(contentsOf: ins < 0 ? [len, ins] : [ins, len])
        }
        return ChangeSet(sections: result, inserted: [])
    }

    /// These changes, then `other` (which starts in the document these produce).
    public func compose(_ other: ChangeSet) -> ChangeSet {
        isEmpty ? other : other.isEmpty ? self : ChangeSetMath.compose(self, other)
    }

    /// These changes mapped over `other` (both start in the same document); `before` orders these first.
    public func map(_ other: ChangeSet, before: Bool = false) -> ChangeSet {
        other.isEmpty ? self : ChangeSetMath.map(self, other, before: before)
    }
}

func addSection(_ sections: inout [Int], _ len: Int, _ ins: Int, forceJoin: Bool = false) {
    if len == 0 && ins <= 0 {
        return
    }
    let last = sections.count - 2
    if last >= 0 && ins <= 0 && ins == sections[last + 1] {
        sections[last] += len
    } else if last >= 0 && len == 0 && sections[last] == 0 {
        sections[last + 1] += ins
    } else if forceJoin && last >= 0 {
        sections[last] += len
        sections[last + 1] += ins
    } else {
        sections.append(contentsOf: [len, ins])
    }
}

func addInsert(_ values: inout [String], _ sections: [Int], _ value: String) {
    if value.isEmpty {
        return
    }
    let index = (sections.count - 2) / 2
    if index < values.count {
        values[values.count - 1] += value
    } else {
        while values.count < index {
            values.append("")
        }
        values.append(value)
    }
}
