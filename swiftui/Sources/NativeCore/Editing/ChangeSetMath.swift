// CodeMirror's mapSet and composeSets (@codemirror/state), line for line: mapping one change set over another
// that starts in the same document, and composing two change sets that follow each other.

import Foundation

enum ChangeSetMath {
    struct SectionIter {
        let set: ChangeSet
        var index = 0
        var len = 0
        var ins = 0
        var off = 0

        init(_ set: ChangeSet) {
            self.set = set
            next()
        }

        mutating func next() {
            if index < set.sections.count {
                len = set.sections[index]
                ins = set.sections[index + 1]
                index += 2
            } else {
                len = 0
                ins = -2
            }
            off = 0
        }

        var done: Bool {
            ins == -2
        }

        var len2: Int {
            ins < 0 ? len : ins
        }

        var text: String {
            self.set.insertedText((index - 2) / 2)
        }

        func textBit(_ length: Int?) -> String {
            let whole = text
            let end = length.map { off + $0 } ?? whole.utf16.count
            return TextDocument.utf16Slice(whole, off, end)
        }

        mutating func forward(_ length: Int) {
            if length == len {
                next()
            } else {
                len -= length
                off += length
            }
        }

        mutating func forward2(_ length: Int) {
            if ins == -1 {
                forward(length)
            } else if length == ins {
                next()
            } else {
                ins -= length
                off += length
            }
        }
    }

    /// A copy of `setA` that applies after `setB` (both start in the same document).
    static func map(_ setA: ChangeSet, _ setB: ChangeSet, before: Bool) -> ChangeSet {
        var sections: [Int] = [], insert: [String] = []
        var a = SectionIter(setA), b = SectionIter(setB)
        var inserted = -1
        while true {
            if (a.done && b.len > 0) || (b.done && a.len > 0) {
                return setA
            } else if a.ins == -1 && b.ins == -1 {
                let length = min(a.len, b.len)
                addSection(&sections, length, -1)
                a.forward(length)
                b.forward(length)
            } else if b.ins >= 0
                && (a.ins < 0 || inserted == a.index || (a.off == 0 && (b.len < a.len || (b.len == a.len && !before))))
            {
                var length = b.len
                addSection(&sections, b.ins, -1)
                while length > 0 {
                    let piece = min(a.len, length)
                    if a.ins >= 0 && inserted < a.index && a.len <= piece {
                        addSection(&sections, 0, a.ins)
                        addInsert(&insert, sections, a.text)
                        inserted = a.index
                    }
                    a.forward(piece)
                    length -= piece
                }
                b.next()
            } else if a.ins >= 0 {
                var length = 0, left = a.len
                while left > 0 {
                    if b.ins == -1 {
                        let piece = min(left, b.len)
                        length += piece
                        left -= piece
                        b.forward(piece)
                    } else if b.ins == 0 && b.len < left {
                        left -= b.len
                        b.next()
                    } else {
                        break
                    }
                }
                addSection(&sections, length, inserted < a.index ? a.ins : 0)
                if inserted < a.index {
                    addInsert(&insert, sections, a.text)
                }
                inserted = a.index
                a.forward(a.len - left)
            } else if a.done && b.done {
                return ChangeSet(sections: sections, inserted: insert)
            } else {
                return setA
            }
        }
    }

    /// `setA` then `setB`, as one set.
    static func compose(_ setA: ChangeSet, _ setB: ChangeSet) -> ChangeSet {
        var sections: [Int] = [], insert: [String] = []
        var a = SectionIter(setA), b = SectionIter(setB)
        var open = false
        while true {
            if a.done && b.done {
                return ChangeSet(sections: sections, inserted: insert)
            } else if a.ins == 0 {
                addSection(&sections, a.len, 0, forceJoin: open)
                a.next()
            } else if b.len == 0 && !b.done {
                addSection(&sections, 0, b.ins, forceJoin: open)
                addInsert(&insert, sections, b.text)
                b.next()
            } else if a.done || b.done {
                return setA
            } else {
                let length = min(a.len2, b.len), sectionCount = sections.count
                if a.ins == -1 {
                    let insB = b.ins == -1 ? -1 : b.off > 0 ? 0 : b.ins
                    addSection(&sections, length, insB, forceJoin: open)
                    if insB > 0 {
                        addInsert(&insert, sections, b.text)
                    }
                } else if b.ins == -1 {
                    addSection(&sections, a.off > 0 ? 0 : a.len, length, forceJoin: open)
                    addInsert(&insert, sections, a.textBit(length))
                } else {
                    addSection(&sections, a.off > 0 ? 0 : a.len, b.off > 0 ? 0 : b.ins, forceJoin: open)
                    if b.off == 0 {
                        addInsert(&insert, sections, b.text)
                    }
                }
                open = (a.ins > length || (b.ins >= 0 && b.len > length)) && (open || sections.count > sectionCount)
                a.forward2(length)
                b.forward(length)
            }
        }
    }
}
