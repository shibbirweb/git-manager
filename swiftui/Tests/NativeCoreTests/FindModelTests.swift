// The find bar's model and commands, checked against findModel.test.ts and @codemirror/search's findNext,
// findPrevious, replaceNext and replaceAll.

import NativeCore
import Testing

private func state(_ text: String, _ anchor: Int = 0, _ head: Int? = nil) -> EditorState {
    EditorState(doc: TextDocument(text), selection: .single(anchor, head ?? anchor))
}

private let regex = FindOptions(regex: true)

@Test func queriesMatchLiterallyCaseInsensitivelyAndByWords() {
    let words = FindQuery(search: "a\\nb", options: FindOptions(matchCase: true, wholeWords: true))
    #expect(FindModel.count(state("a\\nb a\nb"), words).total == 1)
    let doc = "Cart cart carts"
    #expect(FindModel.count(state(doc), FindQuery(search: "cart")).total == 3)
    #expect(FindModel.count(state(doc), FindQuery(search: "cart", options: FindOptions(matchCase: true))).total == 2)
    #expect(FindModel.count(state(doc), FindQuery(search: "cart", options: FindOptions(wholeWords: true))).total == 2)
    #expect(FindModel.count(state("a a a"), FindQuery(search: "a", excluded: [0..<1])).total == 2)
}

@Test func regexReplacementsUseGroupsAndEscapes() {
    let query = FindQuery(search: "(\\w+)@(\\w+)", replace: "$2 at $1\\t", options: regex)
    let doc = TextDocument("ada@home bob@work")
    #expect(query.valid)
    #expect(query.matches(in: doc).count == 2)
    #expect(query.replacement(for: 0..<8, in: doc) == "home at ada\t")
    let literal = FindQuery(search: "ada", replace: "$1\\t")
    #expect(literal.replacement(for: 0..<3, in: doc) == "$1\\t")
}

@Test func regexErrorsSelectionQueriesAndCounters() {
    #expect(FindModel.regexError("add(", regex: true) != nil)
    #expect(FindModel.regexError("add(", regex: false) == nil)
    #expect(FindModel.regexError("add\\(", regex: true) == nil)
    #expect(FindModel.regexError("", regex: true) == nil)
    #expect(FindModel.selectionQuery("cart", regex: false) == "cart")
    #expect(FindModel.selectionQuery("", regex: false) == nil)
    #expect(FindModel.selectionQuery("a\nb", regex: false) == nil)
    #expect(FindModel.selectionQuery("a\r\nb", regex: false) == nil)
    #expect(FindModel.selectionQuery(String(repeating: "x", count: 501), regex: false) == nil)
    #expect(FindModel.selectionQuery("a.b(c)", regex: true) == "a\\.b\\(c\\)")
    let none = FindModel.MatchCount(total: 0, capped: false, current: nil)
    #expect(FindModel.counter("", none, error: nil) == FindModel.Counter(text: "", problem: false))
    #expect(FindModel.counter("x", none, error: nil) == FindModel.Counter(text: "0 results", problem: true))
    let twelve = FindModel.MatchCount(total: 12, capped: false, current: 3)
    #expect(FindModel.counter("x", twelve, error: nil).text == "3/12")
    #expect(FindModel.counter("x", FindModel.MatchCount(total: 1, capped: false, current: nil), error: nil).text
        == "1 result")
    #expect(FindModel.counter("x", FindModel.MatchCount(total: 10000, capped: true, current: 7), error: nil).text
        == "7/10000+")
    #expect(FindModel.counter("(", none, error: "bad") == FindModel.Counter(text: "Invalid regex", problem: true))
}

@Test func countsFindTheSelectedMatchAndStopAtTheCap() {
    let query = FindQuery(search: "ab")
    let second = FindModel.MatchCount(total: 3, capped: false, current: 2)
    #expect(FindModel.count(state("ab ab ab", 3, 5), query) == second)
    #expect(FindModel.count(state("ab ab ab", 1), query).current == nil)
    let many = FindModel.count(state(String(repeating: "a", count: 50), 0, 1), FindQuery(search: "a"), cap: 10)
    #expect(many == FindModel.MatchCount(total: 10, capped: true, current: 1))
    #expect(FindModel.count(state("abc"), FindQuery(search: "(", options: regex)).total == 0)
}

@Test func typingJumpsToTheFirstMatchFromTheAnchorAndWraps() {
    let query = FindQuery(search: "ab")
    #expect(FindModel.firstMatch(state("ab xx ab"), query, from: 1) == 6..<8)
    #expect(FindModel.firstMatch(state("ab xx ab"), query, from: 7) == 0..<2)
    #expect(FindModel.firstMatch(state("ab xx ab"), FindQuery(search: "zz"), from: 0) == nil)
}

@Test func nextPreviousAndReplaceWorkLikeCodeMirror() {
    let query = FindQuery(search: "ab", replace: "X")
    let start = state("ab ab ab", 0, 2)
    #expect(EditorCommands.findNext(start, query)?.selection == .single(3, 5))
    #expect(EditorCommands.findNext(state("ab ab ab", 6, 8), query)?.selection == .single(0, 2))
    #expect(EditorCommands.findPrevious(start, query)?.selection == .single(6, 8))
    let replaced = EditorCommands.replaceNext(start, query)
    let after = start.update(replaced!).state
    #expect(after.doc.string == "X ab ab")
    #expect(after.selection == .single(2, 4))
    let all = EditorCommands.replaceAll(start, query)
    #expect(all?.count == 3)
    #expect(start.update(all!.spec).state.doc.string == "X X X")
    let matches = EditorCommands.selectMatches(start, query)
    #expect(start.update(matches!).state.selection.ranges.count == 3)
    #expect(EditorCommands.selectMatches(start, query, cap: 2) == nil)
}

@Test func rangedSearchesFindWhatTheWholeTextFinds() {
    let doc = TextDocument("cart Cart\ncarts cart_x\n  cart\nxcart cart\n")
    let queries = [
        FindQuery(search: "cart"), FindQuery(search: "cart", options: FindOptions(matchCase: true)),
        FindQuery(search: "cart", options: FindOptions(wholeWords: true)),
        FindQuery(search: "c.rt\\b", options: FindOptions(regex: true)), FindQuery(search: "t\nc"),
        FindQuery(search: "cart", excluded: [10..<14]),
    ]
    for query in queries {
        let all = query.matches(in: doc)
        for from in stride(from: 0, through: doc.length, by: 3) {
            for to in stride(from: from, through: doc.length, by: 4) {
                let inside = all.filter { $0.lowerBound >= from && $0.upperBound <= to }
                #expect(query.matches(in: doc, from: from, to: to) == inside, "\(query.search) \(from)..<\(to)")
            }
        }
    }
}

@Test func asciiSearchesFindWhatFoundationFinds() {
    let text = "Stock stock_x STOCK\nrestock stockstock (stock) st\nSTOck"
    let ascii = TextDocument(text), other = TextDocument(text + "\u{2192}")
    for matchCase in [false, true] {
        for wholeWords in [false, true] {
            let options = FindOptions(matchCase: matchCase, wholeWords: wholeWords)
            for search in ["stock", "STOCK", "st", "k s", "ckst", "x"] {
                for excluded in [[], [6..<11]] as [[Range<Int>]] {
                    let query = FindQuery(search: search, options: options, excluded: excluded)
                    for overlapping in [false, true] {
                        let fast = query.matches(in: ascii, overlapping: overlapping)
                        let slow = query.matches(in: other, from: 0, to: ascii.length, overlapping: overlapping)
                        #expect(fast == slow, "\(search) case \(matchCase) words \(wholeWords) \(excluded)")
                    }
                    #expect(query.matches(in: ascii, from: 5, to: 30) == query.matches(in: other, from: 5, to: 30))
                }
            }
        }
    }
}
