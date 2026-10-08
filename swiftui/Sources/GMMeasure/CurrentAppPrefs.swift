// The current app keeps some view choices (such as "Collapse unchanged" in diffs) in WebKit localStorage, which
// lives under the real ~/Library by bundle id and is shared with the user's own Git Manager, not in the throwaway
// HOME. A run sets the values its scenario needs and puts the user's values back after the app quits.

import Darwin
import Foundation
import MeasureKit

struct CurrentAppPrefs {
    /// What the native app always does: diffs fold unchanged lines (src/lib/diff/prefs.svelte.ts).
    static let scenario = ["git-manager:diff": "{\"collapseUnchanged\":true}"]

    private let storage: WebKitLocalStorage
    private let saved: [String: String?]

    /// Sets the scenario values for the app at `appPath`. Nil when there is nothing to set (the app never stored
    /// anything, so its defaults already match). Refuses while any copy of that app runs, since it holds the file.
    static func apply(appPath: String) throws -> CurrentAppPrefs? {
        guard let bundle = Bundle(path: appPath), let bundleID = bundle.bundleIdentifier,
              let executable = bundle.executableURL?.lastPathComponent else {
            return nil
        }
        // A copy measured a moment ago may still be quitting.
        let deadline = Date().addingTimeInterval(5)
        while runningCopies(executable) && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.2)
        }
        if runningCopies(executable) {
            throw ToolError("Quit Git Manager first: the run sets its diff settings, which the running app holds.")
        }
        guard let storage = WebKitLocalStorage.find(bundleID: bundleID) else {
            return nil
        }
        var saved: [String: String?] = [:]
        for (key, value) in scenario {
            saved[key] = try storage.value(forKey: key)
            try storage.setValue(value, forKey: key)
        }
        return CurrentAppPrefs(storage: storage, saved: saved)
    }

    /// True while any app bundle runs an executable with this name (any copy shares the bundle's localStorage).
    /// By process path, since NSRunningApplication's list goes stale in a tool without a run loop.
    private static func runningCopies(_ executable: String) -> Bool {
        let count = proc_listallpids(nil, 0)
        var pids = [pid_t](repeating: 0, count: Int(max(count, 0)) + 16)
        let found = proc_listallpids(&pids, Int32(pids.count * MemoryLayout<pid_t>.size))
        var buffer = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
        for pid in pids.prefix(Int(max(found, 0))) where pid > 0 {
            if proc_pidpath(pid, &buffer, UInt32(buffer.count)) > 0,
               String(cString: buffer).hasSuffix(".app/Contents/MacOS/\(executable)") {
                return true
            }
        }
        return false
    }

    /// Puts back the user's values (removing keys that were not set before).
    func restore() {
        for (key, value) in saved {
            do {
                try storage.setValue(value, forKey: key)
            } catch {
                print("current: could not restore \(key) in \(storage.databasePath): \(error)")
            }
        }
    }
}
