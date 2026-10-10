// A paragraph whose pieces differ in font as well as color (a hint with <code> words and an inline link button),
// broken greedily at spaces as WebKit breaks it, each word at its exact advance in its own font, lines 17 points
// apart (a 12-point hint's 17.4-point line boxes rounded); a line with code is a point taller, below.

import AppKit
import SwiftUI

struct RichRun {
    enum Face {
        case ui
        /// A plain <code> outside any style: WebKit's default monospace font at the paragraph's size.
        case code
    }

    let text: String
    var face = Face.ui
    var token: String?
    var action: (() -> Void)?
}

struct RichParagraph: View {
    @Environment(\.theme) private var theme

    let runs: [RichRun]
    let width: CGFloat
    var size: CGFloat = 12
    var token = "--text-faint"
    var linePitch: CGFloat = 17

    private struct Piece {
        let text: String
        let run: Int
        let width: CGFloat
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(lines().enumerated()), id: \.offset) { _, line in
                // One baseline for the line's pieces, as WebKit sets mixed fonts.
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    ForEach(Array(line.enumerated()), id: \.offset) { _, piece in
                        pieceView(piece)
                    }
                }
                .frame(height: linePitch, alignment: .leading)
                // The code's box reaches lower than the text's: the line is a point taller below its baseline.
                .padding(.bottom, line.contains { runs[$0.run].face == .code } ? 1 : 0)
            }
        }
        .frame(width: width, alignment: .leading)
    }

    @ViewBuilder
    private func pieceView(_ piece: Piece) -> some View {
        let run = runs[piece.run]
        let text = ExactText(text: piece.text, size: size, face: run.face == .code ? font(.code) : nil)
            .foregroundStyle(theme.ink(run.token ?? token))
        if let action = run.action {
            Button(action: action) {
                text
            }
            .buttonStyle(.plain)
        } else {
            text
        }
    }

    private func font(_ face: RichRun.Face) -> NSFont {
        switch face {
        case .ui:
            return PageFont.ui(size)
        case .code:
            return NSFont(name: "Menlo-Regular", size: size) ?? .monospacedSystemFont(ofSize: size, weight: .regular)
        }
    }

    /// Words (with the space after them) packed into lines no wider than `width`; a line's last space is dropped.
    private func lines() -> [[Piece]] {
        var words: [Piece] = []
        for (index, run) in runs.enumerated() {
            var current = ""
            for character in run.text {
                current.append(character)
                if character == " " {
                    words.append(piece(current, run: index))
                    current = ""
                }
            }
            if !current.isEmpty {
                words.append(piece(current, run: index))
            }
        }
        var lines: [[Piece]] = [[]]
        var used: CGFloat = 0
        for word in words {
            let visible = word.text.hasSuffix(" ") ? ExactText.width(String(word.text.dropLast()),
                                                                      font: font(runs[word.run].face)) : word.width
            if used + visible > width + 0.01, !(lines.last?.isEmpty ?? true) {
                lines.append([])
                used = 0
            }
            lines[lines.count - 1].append(word)
            used += word.width
        }
        return lines.map { line in
            guard let last = line.last, last.text.hasSuffix(" ") else {
                return line
            }
            let trimmed = String(last.text.dropLast())
            return line.dropLast() + [piece(trimmed, run: last.run)]
        }
    }

    private func piece(_ text: String, run: Int) -> Piece {
        Piece(text: text, run: run, width: ExactText.width(text, font: font(runs[run].face)))
    }
}
