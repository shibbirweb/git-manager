// The file editor's pure parts: the blame note, the word highlight and the geometry measured from the current app
// (swiftui/Reference/file-light, demo/acme/storefront src/catalog.ts).

import Foundation
import NativeCore
import Testing

private let now = Date(timeIntervalSince1970: 1_791_417_600)  // 2026-10-08 00:00 UTC

@Test func relativeTimesFollowTheLogsFormat() {
    let utc = TimeZone(identifier: "UTC")!
    let seconds = Int64(now.timeIntervalSince1970)
    #expect(BlameNote.relativeTime(seconds - 30, now: now) == "just now")
    #expect(BlameNote.relativeTime(seconds - 300, now: now) == "5 min ago")
    #expect(BlameNote.relativeTime(seconds - 3 * 3600, now: now) == "3 h ago")
    #expect(BlameNote.relativeTime(seconds - 86_400, now: now) == "yesterday")
    #expect(BlameNote.relativeTime(seconds - 4 * 86_400, now: now) == "4 d ago")
    #expect(BlameNote.relativeTime(seconds - 38 * 86_400, now: now, timeZone: utc) == "Aug 31, 2026")
    #expect(BlameNote.relativeTime(seconds + 60, now: now, timeZone: utc) == "Oct 8, 2026")
}

@Test func theNoteNamesTheLinesCommitOrUncommittedWork() {
    let leo = BlameCommit(
        id: "a1", authorName: "Leo Park", authorTime: Int64(now.timeIntervalSince1970) - 38 * 86_400,
        summary: "Add the product catalog", uncommitted: false
    )
    let typed = BlameCommit(id: "0", authorName: "You", authorTime: 0, summary: "", uncommitted: true)
    let blame = BlameRuns(commits: [leo, typed], runs: [2, 0, 0, 1, 1, 0, 3, 0, 2])
    #expect(BlameNote.commit(atLine: 0, in: blame) == leo)
    #expect(BlameNote.commit(atLine: 2, in: blame) == typed)
    #expect(BlameNote.commit(atLine: 5, in: blame) == leo)
    // The editor's empty last line takes the last run's commit.
    #expect(BlameNote.commit(atLine: 6, in: blame) == leo)
    #expect(BlameNote.label(typed, now: now) == "You, Uncommitted changes")
    #expect(BlameNote.label(nil, now: now) == "You, Uncommitted changes")
    #expect(BlameNote.label(leo, now: now).hasPrefix("Leo Park, Aug "))
    #expect(BlameNote.label(leo, now: now).hasSuffix(" • Add the product catalog"))
}

@Test func theWordAtTheCursorHighlightsWholeWordsOnly() {
    let lines = ["export interface Product {", "  exported: boolean;", "export function x() {}", "  $export"]
        .map { Array($0.utf16) }
    let matches = WordMatches.matches(cursorLine: 0, cursorColumn: 0, visible: 0..<4) { lines[$0] }
    #expect(matches == [
        WordMatches.Match(line: 0, range: 0..<6, main: true),
        WordMatches.Match(line: 2, range: 0..<6, main: false),
        WordMatches.Match(line: 3, range: 3..<9, main: false),
    ])
    // "$" is a word character in TypeScript, so "$export" is another word there.
    let dollar = Set("$".utf16)
    let typed = WordMatches.matches(cursorLine: 0, cursorColumn: 3, visible: 0..<4, extra: dollar) { lines[$0] }
    #expect(typed.count == 2)
    // A cursor between two spaces touches no word.
    #expect(WordMatches.matches(cursorLine: 1, cursorColumn: 1, visible: 0..<4) { lines[$0] }.isEmpty)
}

@Test func theGeometryMatchesTheCurrentAppsEditor() {
    let geometry = EditorGeometry(lineCount: 24, widestLine: 76, advance: 7.8)
    #expect(geometry.numbersWidth == 40)
    #expect(geometry.guttersWidth == 59)
    // .cm-content: 4 + 24 rows + 698.5 points of scrollPastEnd in a 719-point editor.
    #expect(geometry.documentHeight(viewport: 719) == 1086.5)
    // The thumb as measured: 476 points before its 2-point borders, at the top.
    let thumb = EditorGeometry.thumb(track: 719, visible: 719, total: 1086.5, offset: 0)
    #expect(thumb?.start == 0)
    #expect(thumb?.length == 476)
    #expect(EditorGeometry.thumb(track: 719, visible: 719, total: 719, offset: 0) == nil)
    #expect(EditorGeometry(lineCount: 4000, widestLine: 1, advance: 7.8).numbersWidth == 22 + 4 * 7.8)
    #expect(!geometry.scrollsSideways(visibleWidth: 768))
    #expect(EditorGeometry(lineCount: 3, widestLine: 120, advance: 7.8).scrollsSideways(visibleWidth: 768))
}
