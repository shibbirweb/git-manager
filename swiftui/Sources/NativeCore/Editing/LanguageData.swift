// The language data the editing commands read (CodeMirror's languageData of each @codemirror/lang-* package and
// legacy mode the current app loads): comment tokens for Toggle Comment, the brackets that close themselves, the
// lines that indent again as they are typed, and extra word characters. Keyed by EditorInfo's language name.

import Foundation

public struct LanguageData: Sendable {
    public var lineComment: String?
    public var blockComment: (open: String, close: String)?
    public var closeBrackets = ["(", "[", "{", "'", "\""]
    /// Characters before which an opening bracket closes itself (besides whitespace and the line's end).
    public var closeBefore = ")]}:;>"
    public var stringPrefixes: [String] = []
    /// indentOnInput: a line whose text before the cursor matches is indented again after typing.
    public var indentOnInput: String?
    public var wordChars = ""
    /// The language has a syntax tree (a grammar); plain text has none, so quotes never count as strings.
    public var syntax = false

    public init() {}

    public var wordUnits: Set<UInt16> {
        Set(wordChars.utf16)
    }

    /// Whether `lineStart` (a line's text up to the cursor) asks to re-indent.
    public func reindents(_ lineStart: String) -> Bool {
        guard let pattern = indentOnInput,
              let regex = try? NSRegularExpression(pattern: pattern) else {
            return false
        }
        let range = NSRange(lineStart.startIndex..., in: lineStart)
        return regex.firstMatch(in: lineStart, range: range) != nil
    }

    static let cLike: LanguageData = {
        var data = LanguageData()
        data.lineComment = "//"
        data.blockComment = ("/*", "*/")
        data.indentOnInput = #"^\s*(?:case |default:|\{|\})$"#
        return data
    }()

    static let hashComments: LanguageData = {
        var data = LanguageData()
        data.lineComment = "#"
        return data
    }()

    static let markup: LanguageData = {
        var data = LanguageData()
        data.blockComment = ("<!--", "-->")
        return data
    }()

    public static func forLanguage(_ name: String) -> LanguageData {
        var data = LanguageData()
        switch name {
        case "JavaScript", "TypeScript", "JavaScript JSX", "TypeScript JSX", "JSON with Comments":
            data = cLike
            data.closeBrackets = ["(", "[", "{", "'", "\"", "`"]
            data.indentOnInput = #"^\s*(?:case |default:|\{|\}|<\/)$"#
            data.wordChars = "$"
        case "JSON":
            data.closeBrackets = ["[", "{", "\""]
            data.indentOnInput = #"^\s*[\}\]]$"#
        case "CSS", "SCSS", "Less":
            data.blockComment = ("/*", "*/")
            data.indentOnInput = #"^\s*\}$"#
            data.wordChars = "-"
        case "HTML", "Vue", "Svelte", "Blade":
            data = markup
            data.indentOnInput = #"^\s*<\/\w+\W$"#
            data.wordChars = "-_"
        case "XML", "SVG":
            data = markup
            data.indentOnInput = #"^\s*<\/$"#
        case "Markdown":
            data = markup
        case "Python":
            data = hashComments
            data.closeBrackets = ["(", "[", "{", "'", "\"", "'''", "\"\"\""]
            data.stringPrefixes = ["f", "fr", "rf", "r", "u", "b", "br", "rb", "F", "FR", "RF", "R", "U", "B", "BR",
                                   "RB"]
            data.indentOnInput = #"^\s*([\}\]\)]|else:|elif |except |finally:|case\s+[^:]*:?)$"#
        case "Rust":
            data = cLike
            data.indentOnInput = #"^\s*(?:\{|\})$"#
            data.stringPrefixes = ["b", "r", "br"]
        case "Go":
            data = cLike
            data.closeBrackets = ["(", "[", "{", "'", "\"", "`"]
            data.indentOnInput = #"^\s*(?:case\b|default\b|\})$"#
        case "Java", "C", "Kotlin", "Swift", "C#":
            data = cLike
        case "C++":
            data = cLike
            data.stringPrefixes = ["L", "u", "U", "u8", "LR", "UR", "uR", "u8R", "R"]
        case "PHP":
            data = cLike
            data.indentOnInput = #"^\s*(?:case |default:|end(?:if|for(?:each)?|switch|while)|else(?:if)?|\{|\})$"#
            data.wordChars = "$"
            data.stringPrefixes = ["b", "B"]
        case "SQL":
            data.lineComment = "--"
            data.blockComment = ("/*", "*/")
            data.closeBrackets = ["(", "[", "{", "'", "\"", "`"]
        case "YAML":
            data = hashComments
            data.indentOnInput = #"^\s*[\]\}]$"#
        case "Ruby", "Shell Script", "TOML", "Dockerfile":
            data = hashComments
        default:
            break
        }
        data.syntax = name != "Plain Text"
        return data
    }
}
