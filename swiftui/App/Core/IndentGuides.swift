// Indent guides as the current app draws them (src/lib/editor/indentGuides.ts): one guide per indent level a
// line's indentation starts, carried through blank lines, joined down touching blocks. A spacer before a line is
// part of that line's block in CodeMirror, so such a block is "wrapped" and only its first row gets guides.

import Foundation

public enum IndentGuides {
    static let maxBlankScan = 200

    public struct Run: Equatable, Sendable {
        public let level: Int
        public var top: Double
        public var bottom: Double

        public init(level: Int, top: Double, bottom: Double) {
            self.level = level
            self.top = top
            self.bottom = bottom
        }
    }

    struct Block {
        let top: Double
        let height: Double
        let levels: Int
        let wrapped: Bool
    }

    static func indentColumns(_ text: String, tabSize: Int) -> Int? {
        var columns = 0
        for character in text {
            if character == " " {
                columns += 1
            } else if character == "\t" {
                columns += tabSize - columns % tabSize
            } else {
                return columns
            }
        }
        return nil
    }

    static func levelsFor(_ columns: Int, unit: Int) -> Int {
        unit > 0 ? (columns + unit - 1) / unit : 0
    }

    static func blankLevels(above: Int?, below: Int?) -> Int {
        guard let above, let below else {
            return 0
        }
        if above < below {
            return above + 1
        }
        return above == below ? above : below + 1
    }

    /// The guide count of every line (index 0 is line 1).
    public static func levels(lines: [String], tabSize: Int = 4, unit: Int = 2) -> [Int] {
        let own = lines.map { indentColumns($0, tabSize: tabSize).map { levelsFor($0, unit: unit) } }
        func nearest(_ start: Int, _ step: Int) -> Int? {
            var index = start
            var scanned = 0
            while index >= 0, index < own.count, scanned < maxBlankScan {
                if let level = own[index] {
                    return level
                }
                index += step
                scanned += 1
            }
            return nil
        }
        var result = Array(repeating: 0, count: lines.count)
        var above: Int?
        var index = 0
        while index < own.count {
            if let level = own[index] {
                result[index] = level
                above = level
                index += 1
                continue
            }
            var runEnd = index
            while runEnd + 1 < own.count, own[runEnd + 1] == nil {
                runEnd += 1
            }
            let blank = blankLevels(above: above, below: nearest(runEnd + 1, 1))
            for blankIndex in index...runEnd {
                result[blankIndex] = blank
            }
            index = runEnd + 1
        }
        return result
    }

    /// The guides of one pane: its rows as CodeMirror's line blocks, from `metrics.padding` down.
    public static func runs(rows: [DiffRow], levels: [Int], metrics: RowMetrics) -> [Run] {
        var blocks: [Block] = []
        var y = metrics.padding
        var pendingSpacer = 0.0
        for row in rows {
            let height = metrics.height(row)
            switch row {
            case .spacer:
                pendingSpacer += height
            case .line(let number, _, _):
                let level = number - 1 < levels.count ? levels[number - 1] : 0
                let total = height + pendingSpacer
                blocks.append(Block(top: y - pendingSpacer, height: total, levels: level,
                                    wrapped: total > metrics.line * 1.5))
                pendingSpacer = 0
            case .fold(let range):
                let level = range.first - 1 < levels.count ? levels[range.first - 1] : 0
                blocks.append(Block(top: y, height: height, levels: level, wrapped: height > metrics.line * 1.5))
            }
            y += height
        }
        return joined(blocks, rowHeight: metrics.line)
    }

    static func joined(_ blocks: [Block], rowHeight: Double) -> [Run] {
        var runs: [Run] = []
        var open: [Run?] = []
        func close(_ level: Int) {
            if level < open.count, let run = open[level] {
                runs.append(run)
                open[level] = nil
            }
        }
        for block in blocks {
            let bottom = block.top + (block.wrapped ? min(rowHeight, block.height) : block.height)
            let deepest = max(open.count, block.levels)
            while open.count < deepest {
                open.append(nil)
            }
            for level in 0..<deepest {
                if level >= block.levels {
                    close(level)
                    continue
                }
                if var run = open[level], abs(run.bottom - block.top) < 0.5 {
                    run.bottom = bottom
                    open[level] = run
                } else {
                    close(level)
                    open[level] = Run(level: level, top: block.top, bottom: bottom)
                }
                if block.wrapped {
                    close(level)
                }
            }
        }
        for level in open.indices {
            close(level)
        }
        return runs.sorted { ($0.level, $0.top) < ($1.level, $1.top) }
    }
}
