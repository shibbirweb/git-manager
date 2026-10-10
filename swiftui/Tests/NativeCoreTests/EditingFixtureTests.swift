// The editing engine against CodeMirror itself: Fixtures/cm-edit-*.txt hold cases cm-editing.ts ran through the
// current app's CodeMirror (typing with closeBrackets and indentOnInput, Enter, deleting, indenting, line commands,
// comments, Cmd+D, undo and redo, multiple cursors, and seeded random sequences of them).

import Foundation
@testable import NativeCore
import Testing

struct EditFixture {
    var name = "", lang = "", indent = 2, doc = "", steps: [String] = [], expected = ""
    var selection: [SelectionRange] = [], main = 0, expectedSelection = "", expectedMain = 0

    static func load(_ file: String) throws -> [EditFixture] {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/\(file)")
        var cases: [EditFixture] = [], current = EditFixture(), docJSON = "", outJSON = ""
        func decode(_ json: String) throws -> String {
            try JSONDecoder().decode(String.self, from: Data(json.utf8))
        }
        for line in try String(contentsOf: url, encoding: .utf8).split(separator: "\n") {
            let parts = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
            switch parts[0] {
            case "C":
                current = EditFixture(name: parts[1], lang: parts[2], indent: Int(parts[3]) ?? 2)
                docJSON = ""
                outJSON = ""
            case "D", "D+":
                docJSON += parts[1]
            case "S":
                current.doc = try decode(docJSON)
                current.selection = parts[1].split(separator: ";").map { pair in
                    let numbers = pair.split(separator: ",").compactMap { Int($0) }
                    return .range(numbers[0], numbers[1])
                }
                current.main = Int(parts[2]) ?? 0
            case ">":
                current.steps.append(parts[1])
            case "=", "=+":
                outJSON += parts[1]
            case "s":
                current.expected = try decode(outJSON)
                current.expectedSelection = parts[1]
                current.expectedMain = Int(parts[2]) ?? 0
                cases.append(current)
            default:
                break
            }
        }
        return cases
    }

    func run() -> EditorState {
        let languageName = lang == "ts" ? "TypeScript" : "Plain Text"
        let config = EditorConfig(tabSize: indent == 0 ? 4 : indent,
                                  indentUnit: indent == 0 ? "\t" : String(repeating: " ", count: indent),
                                  language: LanguageData.forLanguage(languageName))
        var state = EditorState(doc: TextDocument(doc), selection: EditorSelection(selection, mainIndex: main),
                                config: config)
        let style = IndentRules.style(languageName: languageName)
        var time = 1_000_000.0
        for step in steps {
            if step.hasPrefix("wait:") {
                time += Double(step.dropFirst(5)) ?? 0
                continue
            }
            time += 10
            state = apply(step, to: state, style: style, time: time)
        }
        return state
    }

    func apply(_ step: String, to state: EditorState, style: IndentStyle, time: Double) -> EditorState {
        let decode = { (json: Substring) in
            (try? JSONDecoder().decode(String.self, from: Data(json.utf8))) ?? ""
        }
        if step.hasPrefix("type:") {
            return state.update(EditorInput.type(state, decode(step.dropFirst(5)), style: style), time: time).state
        }
        if step.hasPrefix("paste:") {
            var spec = state.replaceSelection(decode(step.dropFirst(6)))
            spec.userEvent = "input.paste"
            return state.update(spec, time: time).state
        }
        if step.hasPrefix("sel:") {
            let parts = step.dropFirst(4).split(separator: "@")
            let ranges = parts[0].split(separator: ";").map { pair -> SelectionRange in
                let numbers = pair.split(separator: ",").compactMap { Int($0) }
                return .range(numbers[0], numbers[1])
            }
            let main = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
            let spec = TransactionSpec(selection: EditorSelection(ranges, mainIndex: main), userEvent: "select")
            return state.update(spec, time: time).state
        }
        guard let action = EditorAction(rawValue: step) else {
            Issue.record("unknown step \(step)")
            return state
        }
        let context = EditorContext(style: style, time: time)
        return EditorActions.run(action, state, context)?.state ?? state
    }
}

func selectionText(_ state: EditorState) -> String {
    state.selection.ranges.map { "\($0.anchor),\($0.head)" }.joined(separator: ";")
}

@Test func editingMatchesCodeMirror() throws {
    let folder = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
    let files = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        .filter { $0.hasPrefix("cm-edit-") }
    #expect(files.count >= 8)
    for fixture in try files.flatMap({ try EditFixture.load($0) }) {
        let state = fixture.run()
        let steps = fixture.steps.joined(separator: " ")
        if let dump = ProcessInfo.processInfo.environment["GM_FIXTURE_DUMP"],
           state.doc.string != fixture.expected || selectionText(state) != fixture.expectedSelection {
            let text = "== \(fixture.name) [\(steps)] from \(fixture.doc.debugDescription) "
                + "\(fixture.selection.map { "\($0.anchor),\($0.head)" })\n  got  \(state.doc.string.debugDescription) "
                + "\(selectionText(state))\n  want \(fixture.expected.debugDescription) \(fixture.expectedSelection)\n"
            if let handle = FileHandle(forWritingAtPath: dump) {
                handle.seekToEndOfFile()
                handle.write(Data(text.utf8))
                handle.closeFile()
            }
        }
        #expect(state.doc.string == fixture.expected, "\(fixture.name): \(steps)")
        #expect(selectionText(state) == fixture.expectedSelection, "\(fixture.name) selection: \(steps)")
        #expect(state.selection.mainIndex == fixture.expectedMain, "\(fixture.name) main")
    }
}
