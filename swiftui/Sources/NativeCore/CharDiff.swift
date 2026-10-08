// CodeMirror's character diff (@codemirror/merge diff and its helpers), ported line by line so both apps mark the
// same changed text. Works on UTF-16 code units like JavaScript strings; offsets are UTF-16 offsets. The
// presentation pass (makePresentable) and the chunks are in CharDiffChunks.swift.

import Foundation

public struct CharChange: Equatable, Sendable {
    public var fromA: Int
    public var toA: Int
    public var fromB: Int
    public var toB: Int

    public init(_ fromA: Int, _ toA: Int, _ fromB: Int, _ toB: Int) {
        self.fromA = fromA
        self.toA = toA
        self.fromB = fromB
        self.toB = toB
    }

    func offset(_ offA: Int, _ offB: Int) -> CharChange {
        CharChange(fromA + offA, toA + offA, fromB + offB, toB + offB)
    }
}

typealias Units = [UInt16]

public final class CharDiff {
    private var scanLimit: Int
    private var frontier1 = Frontier()
    private var frontier2 = Frontier()
    private(set) var crude = false
    /// CodeMirror recurses without a limit and overflows its stack on some surrogate pairs; past this depth the rest
    /// is one change instead of a crash.
    private var depth = 0

    /// CodeMirror halves the configured scan limit (500 in the current app).
    init(scanLimit: Int) {
        self.scanLimit = scanLimit >> 1
    }

    /// `diff(a, b, { scanLimit })`: the changes between two texts, normalized.
    public static func diff(_ a: String, _ b: String, scanLimit: Int = 500) -> [CharChange] {
        diff(Array(a.utf16), Array(b.utf16), scanLimit: scanLimit)
    }

    static func diff(_ a: Units, _ b: Units, scanLimit: Int) -> [CharChange] {
        if a == b {
            return []
        }
        let engine = CharDiff(scanLimit: scanLimit)
        var changes = engine.findDiff(a, 0, a.count, b, 0, b.count)
        normalize(a, b, &changes)
        return changes
    }

    func findDiff(_ a: Units, _ fromA0: Int, _ toA0: Int, _ b: Units, _ fromB0: Int, _ toB0: Int) -> [CharChange] {
        depth += 1
        defer {
            depth -= 1
        }
        if depth > 500 {
            return [CharChange(fromA0, toA0, fromB0, toB0)]
        }
        let prefix = commonPrefix(a, fromA0, toA0, b, fromB0, toB0)
        let suffix = commonSuffix(a, fromA0 + prefix, toA0, b, fromB0 + prefix, toB0)
        let fromA = fromA0 + prefix, toA = toA0 - suffix, fromB = fromB0 + prefix, toB = toB0 - suffix
        let lenA = toA - fromA, lenB = toB - fromB
        if lenA == 0 || lenB == 0 {
            return [CharChange(fromA, toA, fromB, toB)]
        }
        if lenA > lenB {
            if let found = indexOf(a, fromA, toA, b[fromB..<toB], from: 0) {
                return [CharChange(fromA, fromA + found, fromB, fromB),
                        CharChange(fromA + found + lenB, toA, toB, toB)]
            }
        } else if lenB > lenA {
            if let found = indexOf(b, fromB, toB, a[fromA..<toA], from: 0) {
                return [CharChange(fromA, fromA, fromB, fromB + found),
                        CharChange(toA, toA, fromB + found + lenA, toB)]
            }
        }
        if lenA == 1 || lenB == 1 {
            return [CharChange(fromA, toA, fromB, toB)]
        }
        if let half = halfMatch(a, fromA, toA, b, fromB, toB) {
            return findDiff(a, fromA, half.0, b, fromB, half.1)
                + findDiff(a, half.0 + half.2, toA, b, half.1 + half.2, toB)
        }
        return findSnake(a, fromA, toA, b, fromB, toB)
    }

    /// Myers 1986, from both ends at once.
    private func findSnake(_ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int) -> [CharChange] {
        let lenA = toA - fromA, lenB = toB - fromB
        if scanLimit < 1_000_000_000 && min(lenA, lenB) > scanLimit * 16 {
            if min(lenA, lenB) > scanLimit * 64 {
                return [CharChange(fromA, toA, fromB, toB)]
            }
            return crudeMatch(a, fromA, toA, b, fromB, toB)
        }
        let off = Int((Double(lenA + lenB) / 2).rounded(.up))
        frontier1.reset(off)
        frontier2.reset(off)
        let match1 = { (x: Int, y: Int) in a[fromA + x] == b[fromB + y] }
        let match2 = { (x: Int, y: Int) in a[toA - x - 1] == b[toB - y - 1] }
        let test1Is2 = (lenA - lenB) % 2 != 0
        for depth in 0..<off {
            if depth > scanLimit {
                return crudeMatch(a, fromA, toA, b, fromB, toB)
            }
            var done = frontier1.advance(depth, lenA, lenB, off, test1Is2 ? frontier2 : nil, false, match1)
            if done == nil {
                done = frontier2.advance(depth, lenA, lenB, off, test1Is2 ? nil : frontier1, true, match2)
            }
            if let done {
                return bisect(a, fromA, toA, fromA + done.0, b, fromB, toB, fromB + done.1)
            }
        }
        return [CharChange(fromA, toA, fromB, toB)]
    }

    private func bisect(
        _ a: Units, _ fromA: Int, _ toA: Int, _ splitA0: Int, _ b: Units, _ fromB: Int, _ toB: Int, _ splitB0: Int
    ) -> [CharChange] {
        var splitA = splitA0, splitB = splitB0
        var stop = false
        if !validIndex(a, splitA) {
            splitA += 1
            if splitA == toA {
                stop = true
            }
        }
        if !validIndex(b, splitB) {
            splitB += 1
            if splitB == toB {
                stop = true
            }
        }
        if stop {
            return [CharChange(fromA, toA, fromB, toB)]
        }
        return findDiff(a, fromA, splitA, b, fromB, splitB) + findDiff(a, splitA, toA, b, splitB, toB)
    }

    private func crudeMatch(
        _ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int
    ) -> [CharChange] {
        crude = true
        let lenA = toA - fromA, lenB = toB - fromB
        let result: (Int, Int, Int)?
        if lenA < lenB {
            let inverse = findMatch(b, fromB, toB, a, fromA, toA, lenA / 6, 50)
            result = inverse.map { ($0.1, $0.0, $0.2) }
        } else {
            result = findMatch(a, fromA, toA, b, fromB, toB, lenB / 6, 50)
        }
        guard let (sharedA, sharedB, sharedLen) = result else {
            return [CharChange(fromA, toA, fromB, toB)]
        }
        return findDiff(a, fromA, sharedA, b, fromB, sharedB)
            + findDiff(a, sharedA + sharedLen, toA, b, sharedB + sharedLen, toB)
    }

    private func halfMatch(
        _ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int
    ) -> (Int, Int, Int)? {
        let lenA = toA - fromA, lenB = toB - fromB
        if lenA < lenB {
            return halfMatch(b, fromB, toB, a, fromA, toA).map { ($0.1, $0.0, $0.2) }
        }
        if lenA < 4 || lenB * 2 < lenA {
            return nil
        }
        return findMatch(a, fromA, toA, b, fromB, toB, lenA / 4, -1)
    }

    /// A shared substring, `a` assumed the longer: [startA, startB, length].
    private func findMatch(
        _ a: Units, _ fromA: Int, _ toA: Int, _ b: Units, _ fromB: Int, _ toB: Int, _ size0: Int, _ divideTo: Int
    ) -> (Int, Int, Int)? {
        var best: (Int, Int, Int)?
        var size = size0
        while true {
            if best != nil || size < divideTo {
                return best
            }
            var start = fromA + size
            while true {
                if !validIndex(a, start) {
                    start += 1
                }
                var end = start + size
                if !validIndex(a, end) {
                    end += end == start + 1 ? 1 : -1
                }
                if end >= toA {
                    break
                }
                let seed = a[start..<end]
                if seed.isEmpty {
                    break
                }
                var found = -1
                while let next = indexOf(b, fromB, toB, seed, from: found + 1) {
                    found = next
                    let prefixAfter = commonPrefix(a, end, toA, b, fromB + found + seed.count, toB)
                    let suffixBefore = commonSuffix(a, fromA, start, b, fromB, fromB + found)
                    let length = seed.count + prefixAfter + suffixBefore
                    if best == nil || best!.2 < length {
                        best = (start - suffixBefore, fromB + found - suffixBefore, length)
                    }
                }
                start = end
            }
            if divideTo < 0 {
                return best
            }
            size >>= 1
        }
    }
}
