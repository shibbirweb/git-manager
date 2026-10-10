// The find bar's query (@codemirror/search SearchQuery, as findModel.ts buildQuery makes it): the text literal or a
// regular expression, case-insensitive unless Match Case is on, and with Words only matches that start and end on
// a word boundary. Positions are the document's UTF-16 offsets. Matches skipped with Exclude are left out of every
// search (findPanel.svelte.ts notExcluded). Empty regex matches are left out too.

import Foundation

public struct FindOptions: Equatable, Sendable {
    public var matchCase = false
    public var wholeWords = false
    public var regex = false

    public init(matchCase: Bool = false, wholeWords: Bool = false, regex: Bool = false) {
        self.matchCase = matchCase
        self.wholeWords = wholeWords
        self.regex = regex
    }
}

public struct FindQuery: Equatable, Sendable {
    public var search: String
    public var replace: String
    public var options: FindOptions
    /// Matches skipped with Exclude, kept in place through edits (FindState).
    public var excluded: [Range<Int>]

    public init(search: String = "", replace: String = "", options: FindOptions = FindOptions(),
                excluded: [Range<Int>] = []) {
        self.search = search
        self.replace = replace
        self.options = options
        self.excluded = excluded
    }

    /// Something to look for, and with Regex a pattern that compiles.
    public var valid: Bool {
        !search.isEmpty && (!options.regex || regex != nil)
    }

    var regex: NSRegularExpression? {
        try? NSRegularExpression(pattern: search, options: options.matchCase ? [.anchorsMatchLines]
            : [.anchorsMatchLines, .caseInsensitive])
    }

    /// The matches from `from` to `to`, left to right; overlapping ones too when `overlapping` (nextOverlapping).
    public func matches(in doc: TextDocument, from: Int = 0, to: Int? = nil, limit: Int = Int.max,
                        overlapping: Bool = false) -> [Range<Int>] {
        guard valid else {
            return []
        }
        let end = min(to ?? doc.length, doc.length)
        let start = max(0, min(from, end))
        // Only the lines the range covers, so a search over the rows on screen does not join the whole text; whole
        // lines keep the word boundaries. A search that can span lines takes the whole text.
        let body: String, base: Int
        if spansLines || (start == 0 && end == doc.length) {
            (body, base) = (doc.string, 0)
        } else {
            let first = doc.lineAt(start), last = doc.lineAt(end)
            (body, base) = (doc.slice(first.from, last.to), first.from)
        }
        let text = body as NSString
        var found: [Range<Int>] = []
        if options.regex, let regex {
            let scope = NSRange(location: start - base, length: end - start)
            regex.enumerateMatches(in: body, options: [.withTransparentBounds], range: scope) { result, _, stop in
                guard let range = result?.range, range.length > 0 else {
                    return
                }
                let match = range.location..<(range.location + range.length)
                if accepts(match, in: text, base: base) {
                    found.append((match.lowerBound + base)..<(match.upperBound + base))
                    if found.count >= limit {
                        stop.pointee = true
                    }
                }
            }
            return found
        }
        if let fast = asciiMatches(body, from: start - base, to: end - base, limit: limit, overlapping: overlapping,
                                   base: base) {
            return fast
        }
        let compare: NSString.CompareOptions = options.matchCase ? [.literal] : [.literal, .caseInsensitive]
        var position = start - base
        while position < end - base && found.count < limit {
            let rest = NSRange(location: position, length: end - base - position)
            let range = text.range(of: search, options: compare, range: rest)
            guard range.location != NSNotFound, range.length > 0 else {
                break
            }
            let match = range.location..<(range.location + range.length)
            if accepts(match, in: text, base: base) {
                found.append((match.lowerBound + base)..<(match.upperBound + base))
                position = overlapping ? match.lowerBound + 1 : match.upperBound
            } else {
                position = match.lowerBound + 1
            }
        }
        return found
    }

    /// The search can match across a line break (@codemirror/search's multiline test for a regular expression).
    var spansLines: Bool {
        guard options.regex else {
            return search.contains("\n")
        }
        return search.range(of: #"\\[sWDnr]|\n|\r|\[\^"#, options: .regularExpression) != nil
    }

    /// Words (stringWordTest): a word boundary at both ends; and not excluded. `match` is in `text`, which starts
    /// at the document's offset `base`.
    private func accepts(_ match: Range<Int>, in text: NSString, base: Int = 0) -> Bool {
        if excluded.contains((match.lowerBound + base)..<(match.upperBound + base)) {
            return false
        }
        guard options.wholeWords else {
            return true
        }
        return Self.boundary(at: match.lowerBound, in: text) && Self.boundary(at: match.upperBound, in: text)
    }

    /// No word character on both sides of `offset`.
    static func boundary(at offset: Int, in text: NSString) -> Bool {
        !(isWord(before: offset, in: text) && isWord(after: offset, in: text))
    }

    static func isWord(before offset: Int, in text: NSString) -> Bool {
        offset > 0 && isWordCharacter(text.substring(with: text.rangeOfComposedCharacterSequence(at: offset - 1)))
    }

    static func isWord(after offset: Int, in text: NSString) -> Bool {
        offset < text.length && isWordCharacter(text.substring(with: text.rangeOfComposedCharacterSequence(at: offset)))
    }

    /// CodeMirror's categorizer: \w, letters with case, and the CJK and other ranges it lists.
    static func isWordCharacter(_ character: String) -> Bool {
        guard let scalar = character.unicodeScalars.first else {
            return false
        }
        if scalar == "_" || (scalar.isASCII && (CharacterSet.alphanumerics.contains(scalar))) {
            return true
        }
        let value = scalar.value
        let ranges: [ClosedRange<UInt32>] = [0xDF...0x6FF, 0x1000...0x109F, 0x3040...0x309F, 0x30A0...0x30FF,
                                             0x3400...0x4DB5, 0x4E00...0x9FCC, 0xAC00...0xD7AF]
        return ranges.contains { $0.contains(value) } || character.uppercased() != character.lowercased()
    }

    /// The text a match is replaced with: the field as typed, or with Regex its \n, \r, \t and \\ unescaped and $&,
    /// $$ and $1... filled from the match (RegExpQuery.getReplacement).
    public func replacement(for match: Range<Int>, in doc: TextDocument) -> String {
        guard options.regex, let regex else {
            return replace
        }
        let text = doc.string as NSString
        let scope = NSRange(location: match.lowerBound, length: text.length - match.lowerBound)
        guard let result = regex.firstMatch(in: text as String, options: [.anchored, .withTransparentBounds],
                                            range: scope) else {
            return Self.unquote(replace)
        }
        let groups = (0..<result.numberOfRanges).map { index -> String in
            let range = result.range(at: index)
            return range.location == NSNotFound ? "" : text.substring(with: range)
        }
        return Self.fill(Self.unquote(replace), groups: groups)
    }

    static func unquote(_ text: String) -> String {
        var result = ""
        var escaped = false
        for character in text {
            if escaped {
                switch character {
                case "n": result.append("\n")
                case "r": result.append("\r")
                case "t": result.append("\t")
                case "\\": result.append("\\")
                default: result.append("\\"); result.append(character)
                }
                escaped = false
            } else if character == "\\" {
                escaped = true
            } else {
                result.append(character)
            }
        }
        return escaped ? result + "\\" : result
    }

    /// $& the whole match, $$ a dollar, $12 the longest group number that exists (the rest stays as text).
    static func fill(_ template: String, groups: [String]) -> String {
        let characters = Array(template)
        var result = ""
        var index = 0
        while index < characters.count {
            guard characters[index] == "$", index + 1 < characters.count else {
                result.append(characters[index])
                index += 1
                continue
            }
            let next = characters[index + 1]
            if next == "&" || next == "$" {
                result += next == "&" ? groups[0] : "$"
                index += 2
                continue
            }
            var digits = ""
            var end = index + 1
            while end < characters.count, characters[end].isASCII, characters[end].isNumber {
                digits.append(characters[end])
                end += 1
            }
            var used = false
            for length in stride(from: digits.count, to: 0, by: -1) {
                if let number = Int(digits.prefix(length)), number > 0, number < groups.count {
                    result += groups[number] + digits.dropFirst(length)
                    used = true
                    break
                }
            }
            if !used {
                result += "$" + digits
            }
            index = digits.isEmpty ? index + 1 : end
        }
        return result
    }
}
