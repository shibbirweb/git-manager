// Text of the Settings dialog as the page sets it. A hint is 12-point text in a box of fixed width with a 17.4-point
// line height: WebKit breaks it greedily at spaces (TextWrap in NativeCore, with the font's exact advances) and
// stacks its lines 17 points apart (each line box rounds to whole points). A run can take its own color, as the
// hint's inline links do.

import AppKit
import NativeCore
import SwiftUI

/// A piece of a paragraph with its own color token (nil: the paragraph's).
struct TextRun: Equatable {
    let text: String
    var token: String?
}

struct WrappedText: View {
    @Environment(\.theme) private var theme

    let runs: [TextRun]
    let width: CGFloat
    var size: CGFloat = 12
    var weight = NSFont.Weight.regular
    var token = "--text-dim"
    var linePitch: CGFloat = 17
    /// Ranges of the plain text to mark as search matches.
    var highlights: [Range<Int>] = []

    init(_ text: String, width: CGFloat, size: CGFloat = 12, weight: NSFont.Weight = .regular,
         token: String = "--text-dim", linePitch: CGFloat = 17, highlights: [Range<Int>] = []) {
        runs = [TextRun(text: text)]
        self.width = width
        self.size = size
        self.weight = weight
        self.token = token
        self.linePitch = linePitch
        self.highlights = highlights
    }

    init(runs: [TextRun], width: CGFloat, highlights: [Range<Int>] = []) {
        self.runs = runs
        self.width = width
        self.highlights = highlights
    }

    var body: some View {
        let font = PageFont.ui(size, weight: weight)
        let plain = runs.map(\.text).joined()
        let lines = Self.lines(plain, width: width, font: font)
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                if runs.count > 1 && highlights.isEmpty {
                    // An inline element (the hint's link button) is laid out on its own: no kerning across its
                    // edges, each piece at its exact width.
                    HStack(spacing: 0) {
                        ForEach(Array(pieces(line).enumerated()), id: \.offset) { _, piece in
                            ExactText(text: piece.text, size: size, weight: weight)
                                .foregroundStyle(theme.ink(piece.token ?? token))
                        }
                    }
                    .frame(height: linePitch, alignment: .leading)
                } else {
                    Text(attributed(line, font: font))
                        .lineLimit(1)
                        .fixedSize()
                        .frame(height: linePitch, alignment: .leading)
                }
            }
        }
        .frame(width: width, alignment: .leading)
    }

    /// The paragraph's lines, each with its start in the plain text.
    static func lines(_ text: String, width: CGFloat, font: NSFont) -> [(start: Int, text: String)] {
        let measure = { (line: String) in Double((line as NSString).size(withAttributes: [.font: font]).width) }
        var start = 0
        var result: [(start: Int, text: String)] = []
        let characters = Array(text)
        for line in TextWrap.lines(text, width: Double(width), measure: measure) {
            // Find the line in the text, past the spaces before it.
            while start < characters.count && characters[start] == " " {
                start += 1
            }
            result.append((start, line))
            start += line.count
        }
        return result
    }

    /// The runs' parts on `line`, in order.
    private func pieces(_ line: (start: Int, text: String)) -> [TextRun] {
        let lineRange = line.start..<(line.start + line.text.count)
        var offset = 0
        var result: [TextRun] = []
        for run in runs {
            let runRange = offset..<(offset + run.text.count)
            offset += run.text.count
            let overlap = runRange.clamped(to: lineRange)
            if overlap.isEmpty {
                continue
            }
            let characters = Array(run.text)
            let text = String(characters[(overlap.lowerBound - runRange.lowerBound)..<(overlap.upperBound
                - runRange.lowerBound)])
            result.append(TextRun(text: text, token: run.token))
        }
        return result
    }

    private func attributed(_ line: (start: Int, text: String), font: NSFont) -> AttributedString {
        var result = AttributedString()
        let lineRange = line.start..<(line.start + line.text.count)
        var offset = 0
        for run in runs {
            let runRange = offset..<(offset + run.text.count)
            offset += run.text.count
            let overlap = runRange.clamped(to: lineRange)
            if overlap.isEmpty {
                continue
            }
            let characters = Array(run.text)
            let piece = String(characters[(overlap.lowerBound - runRange.lowerBound)..<(overlap.upperBound
                - runRange.lowerBound)])
            var part = AttributedString(piece)
            part.foregroundColor = theme.ink(run.token ?? token)
            result += part
        }
        result.font = Font(font)
        for match in highlights {
            let overlap = match.clamped(to: lineRange)
            if overlap.isEmpty {
                continue
            }
            let lower = result.index(result.startIndex, offsetByCharacters: overlap.lowerBound - line.start)
            let upper = result.index(result.startIndex, offsetByCharacters: overlap.upperBound - line.start)
            result[lower..<upper].backgroundColor = theme.mix("--warning", 0.4, "--panel")
        }
        return result
    }
}

/// A row's title: 13 points at weight 500, one line, 16 points tall.
struct RowTitle: View {
    let text: String
    var highlights: [Range<Int>] = []

    var body: some View {
        let width = ExactText.width(text, font: PageFont.ui(13, weight: .medium))
        WrappedText(text, width: width + 0.5, size: 13, weight: .medium, token: "--text", linePitch: 16,
                    highlights: highlights)
    }
}
