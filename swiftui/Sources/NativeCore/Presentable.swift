// CodeMirror's makePresentable: changes inside words grow to whole words, plain insertions and deletions slide to
// word or line boundaries, and changes closer than 3 units merge. Ported from @codemirror/merge.

import Foundation

enum Presentable {
    static let maxScan = 8

    static func apply(_ changes: inout [CharChange], _ a: Units, _ b: Units) {
        var posA = 0
        for index in changes.indices {
            var change = changes[index]
            let lenA = change.toA - change.fromA, lenB = change.toB - change.fromB
            if lenA > 0 && lenB > 0 || lenA > 3 || lenB > 3 {
                let nextChangeA = index == changes.count - 1 ? a.count : changes[index + 1].fromA
                let maxScanBefore = change.fromA - posA, maxScanAfter = nextChangeA - change.toA
                var boundBefore = wordBoundaryBefore(a, change.fromA, maxScanBefore)
                var boundAfter = wordBoundaryAfter(a, change.toA, maxScanAfter)
                var lenBefore = change.fromA - boundBefore, lenAfter = boundAfter - change.toA
                if (lenA == 0 || lenB == 0) && lenBefore > 0 && lenAfter > 0 {
                    let changeLen = max(lenA, lenB)
                    let (text, from, to) = lenA > 0 ? (a, change.fromA, change.toA) : (b, change.fromB, change.toB)
                    if changeLen > lenBefore
                        && a[boundBefore..<change.fromA].elementsEqual(text[(to - lenBefore)..<to]) {
                        change = CharChange(boundBefore, boundBefore + lenA, change.fromB - lenBefore,
                                            change.toB - lenBefore)
                        changes[index] = change
                        boundBefore = change.fromA
                        boundAfter = wordBoundaryAfter(a, change.toA, nextChangeA - change.toA)
                    } else if changeLen > lenAfter
                        && a[change.toA..<boundAfter].elementsEqual(text[from..<(from + lenAfter)]) {
                        change = CharChange(boundAfter - lenA, boundAfter, change.fromB + lenAfter,
                                            change.toB + lenAfter)
                        changes[index] = change
                        boundAfter = change.toA
                        boundBefore = wordBoundaryBefore(a, change.fromA, change.fromA - posA)
                    }
                    lenBefore = change.fromA - boundBefore
                    lenAfter = boundAfter - change.toA
                }
                if lenBefore > 0 || lenAfter > 0 {
                    change = CharChange(change.fromA - lenBefore, change.toA + lenAfter, change.fromB - lenBefore,
                                        change.toB + lenAfter)
                    changes[index] = change
                } else if lenA == 0 {
                    change = alignToLine(change, inB: true, b, maxScanBefore, maxScanAfter)
                    changes[index] = change
                } else if lenB == 0 {
                    change = alignToLine(change, inB: false, a, maxScanBefore, maxScanAfter)
                    changes[index] = change
                }
            }
            posA = change.toA
        }
        CharDiff.mergeAdjacent(&changes, minGap: 3)
    }

    /// An insertion (in b) or deletion (in a) moved onto a line boundary when the text allows it.
    private static func alignToLine(
        _ change: CharChange, inB: Bool, _ text: Units, _ maxScanBefore: Int, _ maxScanAfter: Int
    ) -> CharChange {
        let from = inB ? change.fromB : change.fromA, to = inB ? change.toB : change.toA
        let first = lineBreakAfter(text, from, to)
        let last = first < 0 ? -1 : lineBreakBefore(text, to, from)
        if first > -1 {
            let length = first - from
            if length <= maxScanAfter && to + length <= text.count
                && text[from..<first].elementsEqual(text[to..<(to + length)]) {
                return change.offset(length, length)
            }
        }
        if last > -1 {
            let length = to - last
            if length <= maxScanBefore && from - length >= 0
                && text[(from - length)..<from].elementsEqual(text[last..<to]) {
                return change.offset(-length, -length)
            }
        }
        return change
    }

    static func lineBreakBefore(_ text: Units, _ position: Int, _ stop: Int) -> Int {
        var position = position
        while position != stop {
            if text[position - 1] == 10 {
                return position
            }
            position -= 1
        }
        return -1
    }

    static func lineBreakAfter(_ text: Units, _ position: Int, _ stop: Int) -> Int {
        var position = position
        while position != stop {
            if text[position] == 10 {
                return position
            }
            position += 1
        }
        return -1
    }

    static func wordBoundaryAfter(_ text: Units, _ position: Int, _ max: Int) -> Int {
        if position == text.count || wordCharBefore(text, position) == 0 {
            return position
        }
        var current = position
        let end = position + max
        for _ in 0..<maxScan {
            let size = wordCharAfter(text, current)
            if size == 0 || current + size > end {
                return current
            }
            current += size
        }
        return position
    }

    static func wordBoundaryBefore(_ text: Units, _ position: Int, _ max: Int) -> Int {
        if position == 0 || wordCharAfter(text, position) == 0 {
            return position
        }
        var current = position
        let end = position - max
        for _ in 0..<maxScan {
            let size = wordCharBefore(text, current)
            if size == 0 || current - size < end {
                return current
            }
            current -= size
        }
        return position
    }

    static func wordCharAfter(_ text: Units, _ position: Int) -> Int {
        if position == text.count {
            return 0
        }
        let next = text[position]
        if next < 192 {
            return asciiWordChar(next) ? 1 : 0
        }
        if (0xD800...0xDBFF).contains(next) && position < text.count - 1 {
            return isWordChar(Array(text[position..<(position + 2)])) ? 2 : 0
        }
        return isWordChar([next]) ? 1 : 0
    }

    static func wordCharBefore(_ text: Units, _ position: Int) -> Int {
        if position == 0 {
            return 0
        }
        let previous = text[position - 1]
        if previous < 192 {
            return asciiWordChar(previous) ? 1 : 0
        }
        if (0xDC00...0xDFFF).contains(previous) && position > 1 {
            return isWordChar(Array(text[(position - 2)..<position])) ? 2 : 0
        }
        return isWordChar([previous]) ? 1 : 0
    }

    /// CodeMirror's test: 1 to 9 (not 0), A to Z and a to z.
    static func asciiWordChar(_ code: UInt16) -> Bool {
        code > 48 && code < 58 || code > 64 && code < 91 || code > 96 && code < 123
    }

    /// /[\p{Alphabetic}\p{Number}]/u on one character.
    static func isWordChar(_ units: [UInt16]) -> Bool {
        guard let scalar = String(decoding: units, as: UTF16.self).unicodeScalars.first else {
            return false
        }
        let category = scalar.properties.generalCategory
        return scalar.properties.isAlphabetic
            || category == .decimalNumber || category == .letterNumber || category == .otherNumber
    }
}
