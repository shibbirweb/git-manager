// The words of the document as completions (src/lib/editor/wordCompletion.ts and the words source of features.ts):
// the lines within 1500 of the cursor, nearest first, at most 400 distinct words, skipping the word being typed. A
// word is a run of letters, digits, `_` and the language's own word characters (\p{Alphabetic}\p{Number}_ there).
// While typing it answers only in a language with a grammar other than Markdown; Ctrl+Space always.

import Foundation

public enum WordCompletion {
    public static let windowLines = 1500
    public static let maxWords = 400
    /// CompletionContext.matchBefore looks this far back on the line.
    static let matchLimit = 250

    public static func isWordScalar(_ scalar: Unicode.Scalar, extra: Set<UInt32>) -> Bool {
        if scalar.value < 0x80 {
            let value = scalar.value
            return value >= 48 && value <= 57 || value >= 65 && value <= 90 || value >= 97 && value <= 122
                || value == 95 || extra.contains(value)
        }
        if extra.contains(scalar.value) || scalar.properties.isAlphabetic {
            return true
        }
        switch scalar.properties.generalCategory {
        case .decimalNumber, .letterNumber, .otherNumber:
            return true
        default:
            return false
        }
    }

    /// The validFor pattern: the text typed since the result's start is all word characters.
    public static func validFor(wordChars: String) -> CompletionValidFor {
        let escaped = wordChars.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "]", with: "\\]").replacingOccurrences(of: "-", with: "\\-")
            .replacingOccurrences(of: "[", with: "\\[")
        return CompletionValidFor(source: "^[\\p{Alphabetic}\\p{Number}_\(escaped)]+", flags: "u")
    }

    /// The words source: nil when it has nothing to say at `pos`.
    public static func result(doc: TextDocument, pos: Int, explicit: Bool, whileTyping: Bool, wordChars: String)
        -> CompletionResult? {
        if !explicit && !whileTyping {
            return nil
        }
        let extra = Set(wordChars.unicodeScalars.map(\.value))
        let token = tokenStart(doc: doc, pos: pos, extra: extra)
        if token == nil && !explicit {
            return nil
        }
        let from = token ?? pos
        let options = windowWords(doc: doc, pos: pos, extra: extra, ignoreAt: from).map { Completion(label: $0) }
        return CompletionResult(from: from, options: options, validFor: validFor(wordChars: wordChars))
    }

    /// matchBefore(/word+$/): where the run of word characters that ends at `pos` starts, or nil.
    public static func tokenStart(doc: TextDocument, pos: Int, extra: Set<UInt32>) -> Int? {
        let line = doc.lineAt(pos)
        let start = max(line.from, pos - matchLimit)
        let text = TextDocument.utf16Slice(line.text, start - line.from, pos - line.from)
        var from = start + (text as NSString).length
        for scalar in text.unicodeScalars.reversed() {
            guard isWordScalar(scalar, extra: extra) else {
                break
            }
            from -= scalar.utf16.count
        }
        return from < pos ? from : nil
    }

    /// The distinct words near `pos`, nearest lines first, skipping the word starting at `ignoreAt` on the cursor's
    /// line (-1 skips none).
    public static func windowWords(doc: TextDocument, pos: Int, extra: Set<UInt32>, ignoreAt: Int) -> [String] {
        let cursorLine = doc.lineAt(pos)
        let first = max(0, cursorLine.index - windowLines)
        let last = min(doc.lineCount - 1, cursorLine.index + windowLines)
        let skipColumn = ignoreAt >= cursorLine.from && ignoreAt <= cursorLine.to ? ignoreAt - cursorLine.from : -1
        var words: [String] = []
        var seen = Set<String>()
        /// Takes the words of one line; true once the list is full.
        func collect(_ index: Int) -> Bool {
            guard index >= first && index <= last else {
                return false
            }
            var full = false
            eachWord(doc.line(index).text, extra: extra) { column, word in
                if seen.contains(word) || index == cursorLine.index && column == skipColumn {
                    return true
                }
                seen.insert(word)
                words.append(word)
                full = words.count >= maxWords
                return !full
            }
            return full
        }
        // The cursor line, then the lines next to it, moving outward.
        var step = 0
        while cursorLine.index + step <= last || cursorLine.index - step >= first {
            if collect(cursorLine.index + step) || step > 0 && collect(cursorLine.index - step) {
                break
            }
            step += 1
        }
        return words
    }

    /// Calls `body` with each word of `text` and its UTF-16 column, until it answers false.
    static func eachWord(_ text: String, extra: Set<UInt32>, _ body: (Int, String) -> Bool) {
        var column = 0, start = -1
        var current = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            if isWordScalar(scalar, extra: extra) {
                if start < 0 {
                    start = column
                }
                current.append(scalar)
            } else if start >= 0 {
                if !body(start, String(current)) {
                    return
                }
                start = -1
                current = String.UnicodeScalarView()
            }
            column += scalar.utf16.count
        }
        if start >= 0 {
            _ = body(start, String(current))
        }
    }
}
