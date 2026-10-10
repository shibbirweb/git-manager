// Syntax highlighting with the current app's grammars: Resources/highlight.js (Highlight/entry.ts, bundled by
// scripts/build-app.sh) runs in JavaScriptCore on its own queue and answers the spans for a whole text. The
// context is made on first use and dropped after a few idle seconds, so its memory is only held while needed.
// JavaScriptCore's own start (about 35 ms, and it held up the main thread while a diff first painted) happens once
// a second after launch instead, for about 2.4 MB kept.

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

    /// Starts JavaScriptCore with a context dropped at once, so the first highlight only loads the script.
    func warmUp() {
        queue.asyncAfter(deadline: .now() + 1) {
            autoreleasepool {
                _ = JSContext()?.evaluateScript("0")
            }
        }
    }

    /// The syntax spans and bracket colors for `text` (before `upTo` only, when given), or nil when the file's
    /// language has no grammar or the script is missing.
    func spans(filePath: String, text: String, upTo: Int? = nil) async -> SyntaxColors? {
        await syntax(filePath: filePath, text: text, upTo: upTo, folds: false).colors
    }

    /// The colors and, for the file editor, what each line can fold (CodeMirror's foldable).
    func syntax(filePath: String, text: String, upTo: Int? = nil, folds: Bool = true) async
        -> (colors: SyntaxColors?, folds: FoldRanges) {
        var options: [String: Any] = ["folds": folds]
        if let upTo {
            options["upTo"] = upTo
        }
        return await withCheckedContinuation { [options] continuation in
            queue.async {
                continuation.resume(returning: self.highlight(filePath: filePath, text: text, options: options))
            }
        }
    }

    /// Both sides of a diff: first up to a margin past the first change (SyntaxWindow), handed to `show`, then whole
    /// once more when the first pass stopped early. `show` answers false when the diff is gone.
    func diffSpans(filePath: String, original: String, modified: String, hunks: [DiffHunk],
                   show: @MainActor (SyntaxColors?, SyntaxColors?) -> Bool) async {
        let ends = SyntaxWindow.diffEnds(original: original, modified: modified, hunks: hunks)
        async let originalHead = spans(filePath: filePath, text: original, upTo: ends.original)
        async let modifiedHead = spans(filePath: filePath, text: modified, upTo: ends.modified)
        var colors = await (originalHead, modifiedHead)
        guard await show(colors.0, colors.1), ends.original != nil || ends.modified != nil else {
            return
        }
        if ends.original != nil {
            colors.0 = await spans(filePath: filePath, text: original)
        }
        if ends.modified != nil {
            colors.1 = await spans(filePath: filePath, text: modified)
        }
        _ = await show(colors.0, colors.1)
    }

    private func highlight(filePath: String, text: String, options: [String: Any])
        -> (colors: SyntaxColors?, folds: FoldRanges) {
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
        let promise = function.call(withArguments: [filePath, text, options])
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
