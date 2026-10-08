// Reads and writes an app's WebKit localStorage on disk (~/Library/WebKit/<bundle id>/WebsiteData/Default/
// <origin>/<origin>/LocalStorage/localstorage.sqlite3), which keys by bundle id, not HOME. gm-measure uses it to
// give the current app the settings a scenario needs and to put the user's own values back afterwards. Only safe
// while no copy of that app is running.

import Foundation
import SQLite3

public struct WebKitLocalStorage {
    public let databasePath: String

    public init(databasePath: String) {
        self.databasePath = databasePath
    }

    /// The localStorage of `bundleID` for the user, or nil when the app has never stored anything.
    public static func find(bundleID: String, home: String = NSHomeDirectory()) -> WebKitLocalStorage? {
        let root = (home as NSString).appendingPathComponent("Library/WebKit/\(bundleID)/WebsiteData/Default")
        let files = FileManager.default
        for origin in (try? files.contentsOfDirectory(atPath: root)) ?? [] {
            let originDir = (root as NSString).appendingPathComponent(origin)
            for inner in (try? files.contentsOfDirectory(atPath: originDir)) ?? [] {
                let path = (originDir as NSString).appendingPathComponent("\(inner)/LocalStorage/localstorage.sqlite3")
                if files.fileExists(atPath: path) {
                    return WebKitLocalStorage(databasePath: path)
                }
            }
        }
        return nil
    }

    /// The stored string for `key`, or nil when the key is not set.
    public func value(forKey key: String) throws -> String? {
        try withDatabase { database in
            let statement = try prepare(database, "SELECT value FROM ItemTable WHERE key = ?")
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_text(statement, 1, key, -1, transient)
            guard sqlite3_step(statement) == SQLITE_ROW, let bytes = sqlite3_column_blob(statement, 0) else {
                return nil
            }
            let data = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, 0)))
            return String(data: data, encoding: .utf16LittleEndian)
        }
    }

    /// Stores `value` for `key` (WebKit keeps values as UTF-16), or removes the key when `value` is nil.
    public func setValue(_ value: String?, forKey key: String) throws {
        try withDatabase { database in
            guard let value else {
                let statement = try prepare(database, "DELETE FROM ItemTable WHERE key = ?")
                defer { sqlite3_finalize(statement) }
                sqlite3_bind_text(statement, 1, key, -1, transient)
                try step(statement, database)
                return
            }
            let statement = try prepare(database, "INSERT INTO ItemTable (key, value) VALUES (?, ?)")
            defer { sqlite3_finalize(statement) }
            let data = value.data(using: .utf16LittleEndian) ?? Data()
            sqlite3_bind_text(statement, 1, key, -1, transient)
            _ = data.withUnsafeBytes { bytes in
                sqlite3_bind_blob(statement, 2, bytes.baseAddress, Int32(data.count), transient)
            }
            try step(statement, database)
        }
    }

    private var transient: sqlite3_destructor_type {
        unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    }

    private func withDatabase<T>(_ work: (OpaquePointer) throws -> T) throws -> T {
        var database: OpaquePointer?
        guard sqlite3_open_v2(databasePath, &database, SQLITE_OPEN_READWRITE, nil) == SQLITE_OK, let database else {
            sqlite3_close(database)
            throw ToolError("Could not open \(databasePath)")
        }
        defer { sqlite3_close(database) }
        // WebKit's storage process can hold the file for a moment after the app quits.
        sqlite3_busy_timeout(database, 5000)
        return try work(database)
    }

    private func prepare(_ database: OpaquePointer, _ sql: String) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw ToolError("localStorage: \(String(cString: sqlite3_errmsg(database)))")
        }
        return statement
    }

    private func step(_ statement: OpaquePointer, _ database: OpaquePointer) throws {
        if sqlite3_step(statement) != SQLITE_DONE {
            throw ToolError("localStorage: \(String(cString: sqlite3_errmsg(database)))")
        }
    }
}
