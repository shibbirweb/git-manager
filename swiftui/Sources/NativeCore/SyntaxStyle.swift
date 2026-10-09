// What a highlighted span looks like, from its tok-* classes, by the rules in src/app.css: the color token of the
// last single-class rule that matches (rules later in app.css win), except that .tok-variableName.tok-definition
// (two classes, so more specific) always takes --tok-function.

import Foundation

public struct SyntaxStyle: Equatable, Sendable {
    public var colorToken: String?
    public var italic = false
    public var bold = false
    public var underline = false

    public init(colorToken: String? = nil, italic: Bool = false, bold: Bool = false, underline: Bool = false) {
        self.colorToken = colorToken
        self.italic = italic
        self.bold = bold
        self.underline = underline
    }

    /// The color rules in app.css order.
    static let colorRules: [(classes: [String], token: String)] = [
        (["tok-keyword"], "--tok-keyword"),
        (["tok-bool", "tok-atom"], "--tok-constant"),
        (["tok-operator"], "--tok-operator"),
        (["tok-string", "tok-string2", "tok-literal"], "--tok-string"),
        (["tok-number"], "--tok-number"),
        (["tok-comment"], "--tok-comment"),
        (["tok-typeName", "tok-className", "tok-namespace"], "--tok-type"),
        (["tok-function", "tok-macroName"], "--tok-function"),
        (["tok-propertyName", "tok-labelName"], "--tok-property"),
        (["tok-meta"], "--tok-meta"),
        (["tok-tagName"], "--tok-tag"),
        (["tok-attributeName"], "--tok-attr"),
        (["tok-invalid"], "--tok-invalid"),
        // Bracket pair colors (bracketColors.ts), drawn over the syntax colors.
        (["cm-gm-bracket-1"], "--bracket-1"),
        (["cm-gm-bracket-2"], "--bracket-2"),
        (["cm-gm-bracket-3"], "--bracket-3"),
        (["cm-gm-bracket-unmatched"], "--tok-invalid"),
    ]

    public static func resolve(_ classList: String) -> SyntaxStyle {
        let classes = Set(classList.split(separator: " ").map(String.init))
        var style = SyntaxStyle()
        for rule in colorRules where rule.classes.contains(where: classes.contains) {
            style.colorToken = rule.token
        }
        if classes.contains("tok-variableName") && classes.contains("tok-definition") {
            style.colorToken = "--tok-function"
        }
        style.italic = classes.contains("tok-comment") || classes.contains("tok-emphasis")
        style.bold = classes.contains("tok-heading") || classes.contains("tok-strong")
        style.underline = classes.contains("tok-link") || classes.contains("tok-url")
        return style
    }
}

/// Highlighted spans of a whole text, as gmHighlight answers them: UTF-16 offsets into the text.
public struct SyntaxSpans: Equatable, Sendable {
    public struct Span: Equatable, Sendable {
        public let from: Int
        public let to: Int
        public let style: SyntaxStyle

        public init(from: Int, to: Int, style: SyntaxStyle) {
            self.from = from
            self.to = to
            self.style = style
        }
    }

    public let spans: [Span]

    public init(spans: [Span]) {
        self.spans = spans
    }

    /// From gmHighlight's flat JSON array: from, to, classes, from, to, classes, ...
    public init(flat values: [Any]) {
        var spans: [Span] = []
        var cache: [String: SyntaxStyle] = [:]
        var index = 0
        while index + 2 < values.count {
            if let from = values[index] as? Int, let to = values[index + 1] as? Int,
                let classes = values[index + 2] as? String {
                let style = cache[classes] ?? SyntaxStyle.resolve(classes)
                cache[classes] = style
                if style != SyntaxStyle() {
                    spans.append(Span(from: from, to: to, style: style))
                }
            }
            index += 3
        }
        self.spans = spans
    }

    /// The spans inside one line (from `lineStart`, `length` units long), relative to the line's start.
    public func line(start lineStart: Int, length: Int) -> [Span] {
        var low = 0, high = spans.count
        while low < high {
            let middle = (low + high) / 2
            if spans[middle].to <= lineStart {
                low = middle + 1
            } else {
                high = middle
            }
        }
        var result: [Span] = []
        let lineEnd = lineStart + length
        while low < spans.count, spans[low].from < lineEnd {
            let span = spans[low]
            let from = max(span.from, lineStart) - lineStart, to = min(span.to, lineEnd) - lineStart
            if to > from {
                result.append(Span(from: from, to: to, style: span.style))
            }
            low += 1
        }
        return result
    }
}

/// A text's syntax spans and, drawn over them, its bracket pair colors.
public struct SyntaxColors: Equatable, Sendable {
    public let spans: SyntaxSpans
    public let brackets: SyntaxSpans

    public init(spans: SyntaxSpans, brackets: SyntaxSpans) {
        self.spans = spans
        self.brackets = brackets
    }

    /// Both for one line, the brackets last so they win.
    public func line(start lineStart: Int, length: Int) -> [SyntaxSpans.Span] {
        spans.line(start: lineStart, length: length) + brackets.line(start: lineStart, length: length)
    }
}
