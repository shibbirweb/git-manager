// Completion against @codemirror/autocomplete and the page's word source: FuzzyMatcher's scores and matched ranges
// (Fixtures/cm-fuzzy.txt, from the package's own class), windowWords (Fixtures/cm-words.txt, from wordCompletion.ts),
// the sort and its deduplication, validFor patterns, and the commands' selection steps and inserted text.

import Foundation
@testable import NativeCore
import Testing

private func fixture(_ name: String) throws -> String {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/\(name)")
    return try String(contentsOf: url, encoding: .utf8)
}

struct CompletionMatcherTests {
    @Test func fuzzyMatcherMatchesThePackage() throws {
        var matcher: FuzzyMatcher?
        var lastPattern: String?
        var count = 0
        for line in try fixture("cm-fuzzy.txt").split(separator: "\n") where !line.hasPrefix("#") {
            let row = try #require(try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [Any])
            let pattern = try #require(row[0] as? String), word = try #require(row[1] as? String)
            if pattern != lastPattern {
                matcher = FuzzyMatcher(pattern)
                lastPattern = pattern
            }
            let found = matcher?.match(word)
            let score = row[2] as? Int, matched = row[3] as? [Int] ?? []
            #expect(found?.score == score, "\(pattern) / \(word)")
            if score != nil {
                #expect(found?.matched == matched, "\(pattern) / \(word)")
            }
            count += 1
        }
        #expect(count > 50)
    }

    @Test func wordsAroundTheCursor() throws {
        let doc = TextDocument(try fixture("cm-words-doc.txt"))
        var cases: [(pos: Int, chars: String, words: [String])] = []
        for line in try fixture("cm-words.txt").split(separator: "\n") where !line.hasPrefix("#") {
            let json = Data(line.dropFirst(2).utf8)
            if line.hasPrefix("C ") {
                let head = try #require(try JSONSerialization.jsonObject(with: json) as? [String: Any])
                cases.append((head["pos"] as? Int ?? 0, head["chars"] as? String ?? "", []))
            } else {
                cases[cases.count - 1].words += try JSONDecoder().decode([String].self, from: json)
            }
        }
        #expect(cases.count == 5)
        for entry in cases {
            let extra = Set(entry.chars.unicodeScalars.map(\.value))
            let words = WordCompletion.windowWords(doc: doc, pos: entry.pos, extra: extra, ignoreAt: entry.pos)
            #expect(words == entry.words, "at \(entry.pos)")
        }
    }

    @Test func wordSourceAnswersOnlyWhenItShould() {
        let doc = TextDocument("total = 1\n    th")
        let end = doc.length
        let typing = WordCompletion.result(doc: doc, pos: end, explicit: false, whileTyping: true, wordChars: "")
        #expect(typing?.from == end - 2)
        #expect(typing?.options.map(\.label) == ["total", "1"])
        #expect(WordCompletion.result(doc: doc, pos: end, explicit: false, whileTyping: false, wordChars: "") == nil)
        let afterSpace = TextDocument("total = 1\n    ")
        #expect(WordCompletion.result(doc: afterSpace, pos: afterSpace.length, explicit: false, whileTyping: true,
                                      wordChars: "") == nil)
        let asked = WordCompletion.result(doc: afterSpace, pos: afterSpace.length, explicit: true, whileTyping: false,
                                          wordChars: "")
        #expect(asked?.from == afterSpace.length)
    }

    @Test func validForPatternsAreJavaScripts() {
        let identifier = CompletionValidFor(source: "^[\\w$\\xa1-\\uffff][\\w$\\d\\xa1-\\uffff]*$")
        #expect(identifier.test("th"))
        #expect(identifier.test("$el"))
        #expect(!identifier.test("t h"))
        #expect(!identifier.test(""))
        let words = CompletionValidFor(source: "\\w*$")
        #expect(words.test(""))
        #expect(!words.test("é"), "JavaScript's \\w is ASCII only")
        let unicode = WordCompletion.validFor(wordChars: "-")
        #expect(unicode.test("déjà-vu"))
        #expect(!unicode.test("a b"))
    }
}

struct CompletionSortTests {
    private func keyword(_ label: String) -> Completion {
        Completion(label: label, type: "keyword")
    }

    @Test func thInAMethodSortsLikeThePage() {
        let keywords = ["break", "this", "throw", "true", "typeof", "then"].map(keyword)
        let words = ["discounted", "Math", "this", "the", "subtotal"].map { Completion(label: $0) }
        let options = CompletionSort.options([
            .init(source: 0, result: CompletionResult(from: 0, options: keywords), typed: "th", resultID: 1),
            .init(source: 1, result: CompletionResult(from: 0, options: words), typed: "th", resultID: 2),
        ])
        #expect(options.map(\.completion.label) == ["the", "then", "this", "throw", "Math"])
        #expect(options[2].completion.type == "keyword", "the word this is listed once, as the keyword")
        #expect(options[4].match == [2, 4])
    }

    @Test func sameLabelWithDifferentDetailsStaysTwice() {
        let loops = [
            Completion(label: "for", detail: "loop", type: "keyword", apply: .handle(1)),
            Completion(label: "for", detail: "of loop", type: "keyword", apply: .handle(2)),
        ]
        let options = CompletionSort.options([
            .init(source: 0, result: CompletionResult(from: 0, options: loops), typed: "fo"),
        ])
        #expect(options.map(\.completion.detail) == ["loop", "of loop"])
    }
}

struct CompletionCommandTests {
    private func open(_ count: Int, selected: Int = 0, at time: Double = 0) -> CompletionState {
        let options = (0..<count).map { Completion(label: "word\($0)") }
        var completion = CompletionState(sources: [0])
        let state = EditorState(doc: TextDocument("wo"), selection: .single(2))
        let result = ActiveCompletion(source: 0, explicit: false, limit: 1,
                                      result: CompletionResult(from: 0, options: options), from: 0, to: 2,
                                      resultID: 1)
        completion = completion.update(nil, effects: [.setActive([result])], state: state, now: time)
        if selected > 0 {
            completion = completion.update(nil, effects: [.setSelected(selected)], state: state, now: time)
        }
        return completion
    }

    @Test func keysWaitForTheInteractionDelay() {
        let completion = open(5, at: 1000)
        #expect(CompletionCommands.move(completion, forward: true, now: 1050) == nil)
        #expect(CompletionCommands.move(completion, forward: true, now: 1075) == 1)
        #expect(CompletionCommands.acceptable(completion, now: 1074) == nil)
        #expect(CompletionCommands.acceptable(completion, now: 1100)?.completion.label == "word0")
    }

    @Test func movesWrapByOptionAndStopByPage() {
        let first = open(10)
        #expect(CompletionCommands.move(first, forward: false, now: 100) == 9)
        #expect(CompletionCommands.move(first, forward: true, pageRows: 4, now: 100) == 3)
        let last = open(10, selected: 9)
        #expect(CompletionCommands.move(last, forward: true, now: 100) == 0)
        #expect(CompletionCommands.move(last, forward: true, pageRows: 4, now: 100) == 9)
        #expect(CompletionCommands.move(open(10, selected: 1), forward: false, pageRows: 2, now: 100) == 0)
    }

    @Test func pickingReplacesTheTypedTextAtEveryCursor() {
        let doc = TextDocument("a th\nb th\nc tx")
        let state = EditorState(doc: doc, selection: EditorSelection([.cursor(4), .cursor(9), .cursor(14)],
                                                                     mainIndex: 0))
        let spec = CompletionCommands.insertText(state, "this", from: 2, to: 4)
        let next = state.update(spec).state
        #expect(next.doc.string == "a this\nb this\nc tx")
        #expect(next.selection.ranges.map(\.head) == [6, 13, 18])
        #expect(spec.userEvent == "input.complete")
    }

    @Test func renderedRangeFollowsTheSelection() {
        #expect(CompletionCommands.renderedRange(total: 50, selected: 3) == 0..<50)
        #expect(CompletionCommands.renderedRange(total: 250, selected: 120) == 100..<200)
        #expect(CompletionCommands.renderedRange(total: 250, selected: 240) == 150..<250)
    }
}
