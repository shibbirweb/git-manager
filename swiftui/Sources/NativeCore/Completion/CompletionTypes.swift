// What completion sources answer (@codemirror/autocomplete's Completion and CompletionResult) and the options the
// popup lists. The language's own sources run in JavaScriptCore with the current app's grammars, so their options
// arrive as data: an `apply` that is a function there (a snippet) is known here by an identity number only.

import Foundation

public enum CompletionApply: Equatable, Sendable {
    /// Text inserted instead of the label.
    case text(String)
    /// A function of the source (a snippet), kept by the JavaScript side under this number.
    case handle(Int)
}

public struct Completion: Equatable, Sendable {
    public var label: String
    public var displayLabel: String?
    public var detail: String?
    /// "keyword", "function", "variable" ... (several separated by spaces give several badge classes).
    public var type: String?
    public var boost: Int?
    public var apply: CompletionApply?
    public var hasInfo = false
    public var sortText: String?

    public init(label: String, displayLabel: String? = nil, detail: String? = nil, type: String? = nil,
                boost: Int? = nil, apply: CompletionApply? = nil, hasInfo: Bool = false, sortText: String? = nil) {
        self.label = label
        self.displayLabel = displayLabel
        self.detail = detail
        self.type = type
        self.boost = boost
        self.apply = apply
        self.hasInfo = hasInfo
        self.sortText = sortText
    }
}

/// When a result stays valid as typing goes on: the text from `from` to the cursor must match the pattern
/// (anchored at both ends, as ensureAnchor makes it); without one the source is asked again.
public struct CompletionValidFor: Equatable, Sendable {
    public let source: String
    public let flags: String
    private let regex: NSRegularExpression?

    /// A JavaScript RegExp's source and flags.
    public init(source: String, flags: String = "") {
        self.source = source
        self.flags = flags
        var anchored = source
        if !anchored.hasPrefix("^") {
            anchored = "^(?:" + anchored + ")"
        }
        if !anchored.hasSuffix("$") {
            anchored = "(?:" + anchored + ")$"
        }
        regex = try? NSRegularExpression(pattern: Self.icuPattern(anchored),
                                         options: flags.contains("i") ? [.caseInsensitive] : [])
    }

    public func test(_ text: String) -> Bool {
        guard let regex else {
            return false
        }
        return regex.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    public static func == (left: CompletionValidFor, right: CompletionValidFor) -> Bool {
        left.source == right.source && left.flags == right.flags
    }

    /// JavaScript's \w and \d are ASCII only, ICU's are Unicode: they are spelled out.
    static func icuPattern(_ source: String) -> String {
        var out = "", inClass = false, escaped = false
        for char in source {
            if escaped {
                escaped = false
                switch (char, inClass) {
                case ("w", false):
                    out += "[A-Za-z0-9_]"
                case ("W", false):
                    out += "[^A-Za-z0-9_]"
                case ("d", false):
                    out += "[0-9]"
                case ("D", false):
                    out += "[^0-9]"
                case ("w", true):
                    out += "A-Za-z0-9_"
                case ("d", true):
                    out += "0-9"
                default:
                    out += "\\" + String(char)
                }
                continue
            }
            if char == "\\" {
                escaped = true
                continue
            }
            if char == "[" {
                inClass = true
            } else if char == "]" {
                inClass = false
            }
            out.append(char)
        }
        return out
    }
}

public struct CompletionResult: Equatable, Sendable {
    public var from: Int
    public var to: Int?
    public var options: [Completion]
    public var validFor: CompletionValidFor?
    /// False: the options are shown as given, not filtered by the typed text.
    public var filter = true

    public init(from: Int, to: Int? = nil, options: [Completion], validFor: CompletionValidFor? = nil,
                filter: Bool = true) {
        self.from = from
        self.to = to
        self.options = options
        self.validFor = validFor
        self.filter = filter
    }
}

/// One line of the popup: the completion, the source that gave it, the matched ranges of its label and its score.
public struct CompletionOption: Equatable, Sendable {
    public var completion: Completion
    public var source: Int
    public var match: [Int]
    public var score: Int
    /// The result it came from and its index there: the page keeps the selection on the same completion object.
    public var resultID = 0
    public var index = 0

    public func sameCompletion(_ other: CompletionOption) -> Bool {
        resultID == other.resultID && index == other.index && source == other.source
    }
}
