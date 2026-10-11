// Code completion's language sources (Highlight/complete.ts), run in the highlighter's JavaScriptCore context: the
// results of each of the language's sources at a position, and the edit an option's apply function (a snippet)
// makes. The script keeps the last file's parsed state, so asking again after a keystroke parses only the change.

import Foundation
import JavaScriptCore
import NativeCore

extension SyntaxHighlighter {
    /// What the file's editor passes along: its path (the grammar), text and indentation.
    struct CompletionDocument {
        let filePath: String
        let text: String
        let indentUnit: String
        let tabSize: Int
    }

    /// One result per language source in the page's order (nil: that source has nothing here), or nil when the
    /// script is missing.
    func completions(_ document: CompletionDocument, pos: Int, explicit: Bool) async -> [CompletionResult?]? {
        let arguments: [Any] = [document.filePath, document.text, pos, explicit, document.indentUnit,
                                document.tabSize]
        let answer = await run { Self.callAsync($0, "gmComplete", arguments) }
        guard let answer, let data = answer.data(using: .utf8),
              let list = try? JSONSerialization.jsonObject(with: data) as? [Any] else {
            return nil
        }
        return list.map { ($0 as? [String: Any]).flatMap(Self.result) }
    }

    /// The edits of the apply function kept under `handle`, over `from`..`to` with the editor's selection.
    func applyCompletion(_ document: CompletionDocument, handle: Int, label: String, from: Int, to: Int,
                         selection: EditorSelection) async -> [CompletionEdit] {
        let ranges = selection.ranges.map { [$0.anchor, $0.head] }
        let arguments: [Any] = [document.filePath, document.text, document.indentUnit, document.tabSize, handle,
                                label, from, to, ranges, selection.mainIndex]
        let answer = await run { Self.callAsync($0, "gmApplyCompletion", arguments) }
        guard let answer, let data = answer.data(using: .utf8),
              let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        return list.map(Self.edit)
    }

    private static func result(_ object: [String: Any]) -> CompletionResult? {
        guard let from = object["from"] as? Int, let options = object["options"] as? [[String: Any]] else {
            return nil
        }
        let validFor = (object["validFor"] as? [String: Any]).flatMap { pattern in
            (pattern["source"] as? String).map {
                CompletionValidFor(source: $0, flags: pattern["flags"] as? String ?? "")
            }
        }
        return CompletionResult(from: from, to: object["to"] as? Int, options: options.compactMap(completion),
                                validFor: validFor, filter: object["filter"] as? Bool ?? true)
    }

    private static func completion(_ object: [String: Any]) -> Completion? {
        guard let label = object["label"] as? String else {
            return nil
        }
        var apply: CompletionApply?
        if let given = object["apply"] as? [String: Any] {
            if let text = given["text"] as? String {
                apply = .text(text)
            } else if let handle = given["handle"] as? Int {
                apply = .handle(handle)
            }
        }
        return Completion(label: label, displayLabel: object["displayLabel"] as? String,
                          detail: object["detail"] as? String, type: object["type"] as? String,
                          boost: object["boost"] as? Int, apply: apply, hasInfo: object["info"] as? Bool ?? false,
                          sortText: object["sortText"] as? String)
    }

    private static func edit(_ object: [String: Any]) -> CompletionEdit {
        let changes = (object["changes"] as? [[Any]] ?? []).compactMap { change -> ChangeSpec? in
            guard change.count == 3, let from = change[0] as? Int, let to = change[1] as? Int,
                  let insert = change[2] as? String else {
                return nil
            }
            return ChangeSpec(from: from, to: to, insert: insert)
        }
        let selection = (object["selection"] as? [[Int]])?.compactMap { pair in
            pair.count == 2 ? SelectionRange.range(pair[0], pair[1]) : nil
        }
        let fields = (object["fields"] as? [[String: Any]])?.compactMap { field -> SnippetField? in
            guard let number = field["field"] as? Int, let from = field["from"] as? Int,
                  let to = field["to"] as? Int else {
                return nil
            }
            return SnippetField(field: number, from: from, to: to)
        }
        return CompletionEdit(changes: changes, selection: selection, mainIndex: object["main"] as? Int ?? 0,
                              fields: fields, active: object["active"] as? Int ?? 0)
    }
}
