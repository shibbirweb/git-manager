// LogFormat and LogList against src/lib/log/format.ts and LogView.svelte (Intl's en-US formats, the list's rules).

import Foundation
import NativeCore
import Testing

private let utc = TimeZone(identifier: "UTC") ?? .current
/// 2026-10-08 12:00:00 UTC.
private let now = Date(timeIntervalSince1970: 1_791_460_800)
private let nowSeconds = 1_791_460_800

@Test func relativeTimesFollowTheTable() {
    let relative = { (ago: Int) in LogFormat.relativeTime(nowSeconds - ago, now: now, timeZone: utc) }
    #expect(relative(30) == "just now")
    #expect(relative(5 * 60) == "5 min ago")
    #expect(relative(2 * 3600 + 59) == "2 h ago")
    #expect(relative(86400) == "yesterday")
    #expect(relative(6 * 86400) == "6 d ago")
    #expect(relative(9 * 86400) == "Sep 29, 2026")
    #expect(relative(-60) == "Oct 8, 2026")
}

@Test func datesUseIntlFormats() {
    #expect(LogFormat.shortDate(nowSeconds - 37 * 86400, timeZone: utc) == "Sep 1, 2026")
    #expect(LogFormat.fullDate(nowSeconds - 2 * 86400 + 8 * 3600 + 51 * 60, timeZone: utc)
        == "Tue, Oct 6, 2026 at 08:51 PM")
    #expect(LogFormat.fullDate(nowSeconds - 12 * 3600, timeZone: utc) == "Thu, Oct 8, 2026 at 12:00 AM")
}

@Test func lettersRefsAndPaths() {
    #expect(["added", "deleted", "renamed", "copied", "typechange", "modified"].map(LogFormat.statusLetter)
        == ["A", "D", "R", "C", "T", "M"])
    let refs = [("origin/main", "remote"), ("v1", "tag"), ("dev", "local"), ("main", "head"), ("v2", "tag")]
    #expect(LogFormat.sortRefs(refs, kind: \.1).map(\.0) == ["main", "dev", "v1", "v2", "origin/main"])
    #expect(LogFormat.fileName("src/lib/a.ts") == "a.ts")
    #expect(LogFormat.fileDir("src/lib/a.ts") == "src/lib")
    #expect(LogFormat.fileDir("a.ts").isEmpty)
}

@Test func countLabels() {
    #expect(LogFormat.countLabel(loaded: 13, hasMore: false, filtered: nil) == "13 commits")
    #expect(LogFormat.countLabel(loaded: 1, hasMore: false, filtered: nil) == "1 commit")
    #expect(LogFormat.countLabel(loaded: 3000, hasMore: true, filtered: nil) == "3,000+ commits")
    #expect(LogFormat.countLabel(loaded: 300, hasMore: true, filtered: 4) == "4 of 300+ loaded commits")
}

@Test func messagesSplitIntoSubjectAndRest() {
    #expect(LogFormat.splitMessage("  Fix it  ") == ("Fix it", ""))
    let split = LogFormat.splitMessage("Subject\n\n\nBody line\n  more\n\n")
    #expect(split.subject == "Subject")
    #expect(split.rest == "Body line\n  more")
}

@Test func listRules() {
    #expect(LogList.visibleRange(scrollTop: 0, viewportHeight: 382, count: 13) == 0..<13)
    #expect(LogList.visibleRange(scrollTop: 2600, viewportHeight: 400, count: 3000) == 88..<128)
    #expect(LogList.nearEnd(88..<128, count: 200))
    #expect(!LogList.nearEnd(88..<128, count: 300))
    #expect(LogList.matches(query: "e08", commitId: "e0854d", summary: "x", authorName: "y", authorEmail: "z"))
    #expect(LogList.matches(query: "lazy", commitId: "1", summary: "Catalog: Lazy load", authorName: "",
                            authorEmail: ""))
    #expect(!LogList.matches(query: "854", commitId: "e0854d", summary: "", authorName: "", authorEmail: ""))
    #expect(LogList.target(.up, current: -1, count: 5, viewportHeight: 100) == 0)
    #expect(LogList.target(.pageDown, current: 2, count: 50, viewportHeight: 260) == 11)
    #expect(LogList.clamp(60, count: 50) == 49)
    #expect(LogList.ensureVisible(position: 20, scrollTop: 0, viewportHeight: 260) == 286)
    #expect(LogList.ensureVisible(position: 2, scrollTop: 100, viewportHeight: 260) == 52)
    #expect(LogList.ensureVisible(position: 5, scrollTop: 100, viewportHeight: 260) == 100)
    #expect(LogList.listFraction(pointerY: 10, top: 0, height: 100) == 0.15)
}
