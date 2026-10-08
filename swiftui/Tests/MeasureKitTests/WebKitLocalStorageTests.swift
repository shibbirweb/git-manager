import Foundation
import MeasureKit
import SQLite3
import Testing

/// A home folder with an empty WebKit localStorage for `bundleID`, laid out the way WebKit does it.
private func makeHome(bundleID: String) throws -> (home: String, database: String) {
    let home = (NSTemporaryDirectory() as NSString).appendingPathComponent("gm-ls-\(UUID().uuidString)")
    let dir = (home as NSString)
        .appendingPathComponent("Library/WebKit/\(bundleID)/WebsiteData/Default/origin/origin/LocalStorage")
    try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
    let database = (dir as NSString).appendingPathComponent("localstorage.sqlite3")
    var handle: OpaquePointer?
    sqlite3_open(database, &handle)
    let schema = "CREATE TABLE ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB NOT NULL ON CONFLICT FAIL)"
    sqlite3_exec(handle, schema, nil, nil, nil)
    sqlite3_close(handle)
    return (home, database)
}

@Test func localStorageIsFoundByBundleID() throws {
    let made = try makeHome(bundleID: "com.example.app")
    defer { try? FileManager.default.removeItem(atPath: made.home) }
    #expect(WebKitLocalStorage.find(bundleID: "com.example.app", home: made.home)?.databasePath == made.database)
    #expect(WebKitLocalStorage.find(bundleID: "com.example.other", home: made.home) == nil)
}

@Test func localStorageValuesRoundTripAndDelete() throws {
    let made = try makeHome(bundleID: "com.example.app")
    defer { try? FileManager.default.removeItem(atPath: made.home) }
    let storage = WebKitLocalStorage(databasePath: made.database)
    #expect(try storage.value(forKey: "git-manager:diff") == nil)
    try storage.setValue("{\"collapseUnchanged\":false}", forKey: "git-manager:diff")
    try storage.setValue("{\"collapseUnchanged\":true}", forKey: "git-manager:diff")
    #expect(try storage.value(forKey: "git-manager:diff") == "{\"collapseUnchanged\":true}")
    try storage.setValue(nil, forKey: "git-manager:diff")
    #expect(try storage.value(forKey: "git-manager:diff") == nil)
}
