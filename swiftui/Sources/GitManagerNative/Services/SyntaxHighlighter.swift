// Syntax highlighting with the current app's grammars: Resources/highlight.js (Highlight/entry.ts, bundled by
// scripts/build-app.sh) runs in JavaScriptCore on its own queue and answers the spans for a whole text. The
// context is made on first use and dropped after a few idle seconds, so its memory is only held while needed.

import Foundation
import JavaScriptCore
import NativeCore

final class SyntaxHighlighter: @unchecked Sendable {
    static let shared = SyntaxHighlighter()

    /// How long the context stays after the last request.
    private static let idleSeconds = 5.0

    private let queue = DispatchQueue(label: "shibbirweb.gitmanager.native.syntax", qos: .userInitiated)
    private var context: JSContext?
    private var generation = 0

    /// The syntax spans and bracket colors for `text`, or nil when the file's language has no grammar or the script
    /// is missing.
    func spans(filePath: String, text: String) async -> SyntaxColors? {
        await syntax(filePath: filePath, text: text).colors
    }

    /// The colors and, for the file editor, what each line can fold (CodeMirror's foldable).
    func syntax(filePath: String, text: String) async -> (colors: SyntaxColors?, folds: FoldRanges) {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.highlight(filePath: filePath, text: text))
            }
        }
    }

    private func highlight(filePath: String, text: String) -> (colors: SyntaxColors?, folds: FoldRanges) {
        generation += 1
        let current = generation
        defer {
            queue.asyncAfter(deadline: .now() + Self.idleSeconds) {
                if self.generation == current {
                    self.context = nil
                }
            }
        }
        guard let context = loadContext(), let function = context.objectForKeyedSubscript("gmHighlight"),
            !function.isUndefined
        else {
            return (nil, FoldRanges())
        }
        var answer: String?
        let resolved: @convention(block) (JSValue) -> Void = { value in
            answer = value.toString()
        }
        let promise = function.call(withArguments: [filePath, text])
        _ = promise?.invokeMethod("then", withArguments: [JSValue(object: resolved, in: context) as Any])
        guard let answer, let data = answer.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return (nil, FoldRanges())
        }
        let flat = object["folds"] as? [Int] ?? []
        let folds = FoldRanges(stride(from: 0, to: flat.count - 1, by: 2).map {
            CodeFold(from: flat[$0], to: flat[$0 + 1])
        })
        guard let spans = object["spans"] as? [Any], !spans.isEmpty else {
            return (nil, folds)
        }
        let colors = SyntaxColors(
            spans: SyntaxSpans(flat: spans), brackets: SyntaxSpans(flat: object["brackets"] as? [Any] ?? [])
        )
        return (colors, folds)
    }

    private func loadContext() -> JSContext? {
        if let context {
            return context
        }
        guard let url = Bundle.main.url(forResource: "highlight", withExtension: "js"),
            let script = try? String(contentsOf: url, encoding: .utf8), let context = JSContext()
        else {
            return nil
        }
        context.evaluateScript(script, withSourceURL: url)
        self.context = context
        return context
    }
}
