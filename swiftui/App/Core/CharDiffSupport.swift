// The helpers of CodeMirror's character diff (CharDiff.swift): shared prefixes and suffixes, substring search, the
// Myers frontier and the normalizing pass, each as in @codemirror/merge.

import Foundation

extension CharDiff {
    /// Shared prefix length. The `fromA == toB` test is CodeMirror's own, kept so both diffs agree.
    func commonPrefix(_ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int) -> Int {
        CharDiff.commonPrefix(a, fromA, toA, b, fromB, toB)
    }

    func commonSuffix(_ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int) -> Int {
        CharDiff.commonSuffix(a, fromA, toA, b, fromB, toB)
    }

    static func commonPrefix(_ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int) -> Int {
        if fromA == toA || fromA == toB || fromB >= toB || a[fromA] != b[fromB] {
            return 0
        }
        var length = 0
        while fromA + length < toA, fromB + length < toB, a[fromA + length] == b[fromB + length] {
            length += 1
        }
        if fromA + length == toA || fromB + length == toB {
            return length
        }
        return length - (validIndex(a, fromA + length) ? 0 : 1)
    }

    static func commonSuffix(_ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int) -> Int {
        if fromA == toA || fromB == toB || a[toA - 1] != b[toB - 1] {
            return 0
        }
        var length = 0
        while toA - length > fromA, toB - length > fromB, a[toA - length - 1] == b[toB - length - 1] {
            length += 1
        }
        if toA - length == fromA || toB - length == fromB {
            return length
        }
        return length - (validIndex(a, toA - length) ? 0 : 1)
    }

    /// Where `needle` first occurs in `haystack[from..<to]` at or after `start`, relative to `from`.
    func indexOf(_ haystack: Units, _ from: Int, _ to: Int, _ needle: ArraySlice<UInt16>, from start: Int) -> Int? {
        let count = needle.count
        guard count > 0, start >= 0 else {
            return nil
        }
        var position = from + start
        let first = needle[needle.startIndex]
        while position + count <= to {
            if haystack[position] == first, haystack[position..<(position + count)].elementsEqual(needle) {
                return position - from
            }
            position += 1
        }
        return nil
    }

    func validIndex(_ units: Units, _ index: Int) -> Bool {
        CharDiff.validIndex(units, index)
    }

    /// False inside a surrogate pair.
    static func validIndex(_ units: Units, _ index: Int) -> Bool {
        index <= 0 || index >= units.count || !(0xD800...0xDBFF).contains(units[index - 1])
            || !(0xDC00...0xDFFF).contains(units[index])
    }

    static func mergeAdjacent(_ changes: inout [CharChange], minGap: Int) {
        var index = 1
        while index < changes.count {
            let previous = changes[index - 1], current = changes[index]
            if previous.toA > current.fromA - minGap && previous.toB > current.fromB - minGap {
                changes[index - 1] = CharChange(previous.fromA, current.toA, previous.fromB, current.toB)
                changes.remove(at: index)
            } else {
                index += 1
            }
        }
    }

    /// Merges touching changes and slides plain insertions and deletions across matching text.
    static func normalize(_ a: Units, _ b: Units, _ changes: inout [CharChange]) {
        while true {
            mergeAdjacent(&changes, minGap: 1)
            var moved = false
            for index in changes.indices {
                var change = changes[index]
                let pre = commonPrefix(a, change.fromA, change.toA, b, change.fromB, change.toB)
                if pre > 0 {
                    change = CharChange(change.fromA + pre, change.toA, change.fromB + pre, change.toB)
                    changes[index] = change
                }
                let post = commonSuffix(a, change.fromA, change.toA, b, change.fromB, change.toB)
                if post > 0 {
                    change = CharChange(change.fromA, change.toA - post, change.fromB, change.toB - post)
                    changes[index] = change
                }
                let lenA = change.toA - change.fromA, lenB = change.toB - change.fromB
                if lenA > 0 && lenB > 0 {
                    continue
                }
                let beforeLen = change.fromA - (index > 0 ? changes[index - 1].toA : 0)
                let afterLen = (index < changes.count - 1 ? changes[index + 1].fromA : a.count) - change.toA
                if beforeLen == 0 || afterLen == 0 {
                    continue
                }
                let text = lenA > 0 ? a[change.fromA..<change.toA] : b[change.fromB..<change.toB]
                if beforeLen <= text.count
                    && a[(change.fromA - beforeLen)..<change.fromA].elementsEqual(text.suffix(beforeLen)) {
                    changes[index] = change.offset(-beforeLen, -beforeLen)
                    moved = true
                } else if afterLen <= text.count
                    && a[change.toA..<(change.toA + afterLen)].elementsEqual(text.prefix(afterLen)) {
                    changes[index] = change.offset(afterLen, afterLen)
                    moved = true
                }
            }
            if !moved {
                break
            }
        }
    }
}

/// One direction of the Myers search.
struct Frontier {
    var vec: [Int] = []
    var len = 0
    var start = 0
    var end = 0

    mutating func reset(_ off: Int) {
        len = off << 1
        if vec.count < len + 2 {
            vec = Array(repeating: -1, count: len + 2)
        }
        for index in 0..<len {
            vec[index] = -1
        }
        vec[off + 1] = 0
        start = 0
        end = 0
    }

    mutating func advance(
        _ depth: Int, _ lenX: Int, _ lenY: Int, _ vOff: Int, _ other: Frontier?, _ fromBack: Bool,
        _ match: (Int, Int) -> Bool
    ) -> (Int, Int)? {
        var k = -depth + start
        while k <= depth - end {
            let off = vOff + k
            var x = k == -depth || (k != depth && vec[off - 1] < vec[off + 1]) ? vec[off + 1] : vec[off - 1] + 1
            var y = x - k
            while x < lenX && y < lenY && match(x, y) {
                x += 1
                y += 1
            }
            vec[off] = x
            if x > lenX {
                end += 2
            } else if y > lenY {
                start += 2
            } else if let other {
                let offOther = vOff + (lenX - lenY) - k
                if offOther >= 0 && offOther < len && other.vec[offOther] != -1 {
                    if !fromBack {
                        let xOther = lenX - other.vec[offOther]
                        if x >= xOther {
                            return (x, y)
                        }
                    } else {
                        let xOther = other.vec[offOther]
                        if xOther >= lenX - x {
                            return (xOther, vOff + xOther - offOther)
                        }
                    }
                }
            }
            k += 2
        }
        return nil
    }
}
