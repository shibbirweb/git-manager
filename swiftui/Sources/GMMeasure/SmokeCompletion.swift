// gm-measure smoke: code completion on a small TypeScript file (written for the check, removed after it): typing
// "dis" in a method lists the scope's variable first with its type, Enter picks it; "fo" lists the "for" snippets,
// Enter inserts the loop with its first field selected, Tab moves to the next field and from the last one lets the
// fields go; on "th", Down and Up move the selection and Escape closes the popup.

import Foundation
import MeasureKit

extension Smoke {
    static let completionSource = """
        export class Cart {
          private total = 0;

          add(price: number): void {
            const discounted = price * 0.9;
            \("")
            \("")
          }
        }

        """

    static func checkCompletion(_ client: McpClient, repoPath: String, check: (String, Bool, String) -> Void)
        async throws {
        let filePath = (repoPath as NSString).appendingPathComponent("cart.ts")
        try completionSource.write(toFile: filePath, atomically: true, encoding: .utf8)
        defer { try? FileManager.default.removeItem(atPath: filePath) }
        _ = try await client.call("app", ["action": "open_file", "filePath": "cart.ts", "line": 6, "column": 5])
        let typed = try await client.call("app", ["action": "complete", "type": "dis", "waitMs": 500])
        let listed = completion(typed)
        let options = listed["options"] as? [String] ?? []
        check("Typing lists completions, the scope's variable first", listed["open"] as? Bool == true
              && options.first == "discounted" && (listed["types"] as? [Any])?.first as? String == "variable",
              "\(listed)")
        let picked = try await client.call("app", ["action": "complete", "key": "Enter", "waitMs": 100])
        let line6 = lines(picked).count > 5 ? lines(picked)[5] : ""
        check("Enter picks the option", line6 == "    discounted" && completion(picked)["open"] as? Bool == false,
              line6)

        _ = try await client.call("app", ["action": "open_file", "filePath": "cart.ts", "line": 7, "column": 5])
        let loops = try await client.call("app", ["action": "complete", "type": "fo", "waitMs": 500])
        check("Typing lists the language's snippets", (completion(loops)["options"] as? [String])?.first == "for",
              "\(completion(loops))")
        let snippet = try await client.call("app", ["action": "complete", "key": "Enter", "waitMs": 300])
        let fields = completion(snippet)["snippetFields"] as? [[String: Int]] ?? []
        check("Enter inserts the snippet with its first field selected", selection(snippet) == "index"
              && fields.count == 5 && lines(snippet).count > 6
              && lines(snippet)[6] == "    for (let index = 0; index < bound; index++) {",
              "\(selection(snippet)) \(fields.count) fields")
        let painted = try await client.call("app", ["action": "canvas_check"])
        check("Partial repaints match a whole one with the snippet's fields",
              painted.structured?["paintsLikeWhole"] as? Bool == true, painted.text)
        let next = try await client.call("app", ["action": "complete", "key": "Tab", "waitMs": 50])
        let last = try await client.call("app", ["action": "complete", "key": "Tab", "waitMs": 50])
        check("Tab moves through the fields and lets go at the last", selection(next) == "bound"
              && completion(next)["snippetFields"] is [Any] && completion(last)["snippetFields"] is NSNull,
              "\(selection(next)) \(completion(last)["snippetFields"] ?? "nil")")
        let cleared = try await client.call("app", ["action": "canvas_check"])
        check("Partial repaints match a whole one after the fields let go",
              cleared.structured?["paintsLikeWhole"] as? Bool == true, cleared.text)

        let reopened = try await client.call("app", ["action": "complete", "type": "th", "waitMs": 500])
        let down = try await client.call("app", ["action": "complete", "key": "ArrowDown", "waitMs": 50])
        let up = try await client.call("app", ["action": "complete", "key": "ArrowUp", "waitMs": 50])
        check("Down and Up move the selection", completion(down)["selected"] as? Int == 1
              && completion(up)["selected"] as? Int == 0, "\(completion(down)) \(completion(up))")
        let closed = try await client.call("app", ["action": "complete", "key": "Escape", "waitMs": 50])
        check("Escape closes the popup", completion(reopened)["open"] as? Bool == true
              && completion(closed)["open"] as? Bool == false && closed.structured?["handled"] as? Bool == true,
              "\(completion(closed))")

        _ = try await client.call("app", ["action": "complete", "type": "t", "waitMs": 500])
        _ = try await client.call("app", ["action": "editor_command", "command": "code.goToLine"])
        try await Task.sleep(nanoseconds: 1_500_000_000)
        let blurred = try await client.call("app", ["action": "get_state"])
        let popup = completion(blurred)
        _ = try await client.call("app", ["action": "dialog", "cancel": true])
        check("The popup closes when the editor loses the keyboard", popup["open"] as? Bool == false, "\(popup)")
    }

    private static func editorFile(_ answer: ToolAnswer) -> [String: Any] {
        (answer.structured?["editor"] as? [String: Any])?["file"] as? [String: Any] ?? [:]
    }

    private static func completion(_ answer: ToolAnswer) -> [String: Any] {
        editorFile(answer)["completion"] as? [String: Any] ?? [:]
    }

    private static func lines(_ answer: ToolAnswer) -> [String] {
        (editorFile(answer)["text"] as? String ?? "").components(separatedBy: "\n")
    }

    private static func selection(_ answer: ToolAnswer) -> String {
        editorFile(answer)["selection"] as? String ?? ""
    }
}
