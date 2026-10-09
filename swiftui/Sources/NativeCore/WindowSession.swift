// The windows to reopen at start (src-tauri/src/windows.rs session_to_json, parse_session, restore_plan and
// on_screen), kept in state.json under "windows": each window's folders or workspace file and where it was. A hand
// edit never breaks the start: what is malformed is dropped.

import Foundation

public enum WindowSession {
    public struct Entry: Equatable, Sendable {
        public let folders: [String]
        public let workspaceFile: String?
        /// The window's top left (points, y down from the top of the main screen) and its content size.
        public let bounds: CGRect?

        public init(folders: [String], workspaceFile: String? = nil, bounds: CGRect? = nil) {
            self.folders = folders
            self.workspaceFile = workspaceFile
            self.bounds = bounds
        }

        /// Opens nothing: the welcome screen.
        public var isEmpty: Bool {
            folders.isEmpty && workspaceFile == nil
        }
    }

    /// The state.json key.
    public static let key = "windows"
    /// The settings.json key of "Reopen windows on start" (on unless turned off).
    public static let reopenSetting = "reopenWindows"
    public static let maxWindows = 20
    static let maxFolders = 64
    static let minSize = CGSize(width: 400, height: 300)
    static let maxSize = 20000.0
    /// Enough of a window's top edge must be on a screen to grab it, or its saved position is dropped.
    static let grabWidth = 100.0
    static let grabHeight = 30.0

    /// The session as state.json stores it.
    public static func json(_ entries: [Entry]) -> [[String: Any]] {
        entries.map { entry in
            var object: [String: Any] = ["folders": entry.folders, "workspaceFile": entry.workspaceFile ?? NSNull()]
            if let bounds = entry.bounds {
                object["bounds"] = ["x": bounds.minX, "y": bounds.minY, "width": bounds.width,
                                    "height": bounds.height]
            } else {
                object["bounds"] = NSNull()
            }
            return object
        }
    }

    /// A saved session, without what is malformed, the same workspace twice, or windows past the twentieth.
    public static func parse(_ value: Any?) -> [Entry] {
        guard let items = value as? [Any] else {
            return []
        }
        var entries: [Entry] = []
        for item in items {
            guard let object = item as? [String: Any] else {
                continue
            }
            let folders = (object["folders"] as? [Any] ?? []).compactMap { $0 as? String }
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                .prefix(maxFolders)
            let file = (object["workspaceFile"] as? String).flatMap { $0.trimmingCharacters(in: .whitespaces)
                .isEmpty ? nil : $0 }
            let entry = Entry(folders: Array(folders), workspaceFile: file, bounds: bounds(object["bounds"]))
            if !entry.isEmpty && entries.contains(where: { $0.folders == entry.folders
                && $0.workspaceFile == entry.workspaceFile }) {
                continue
            }
            entries.append(entry)
            if entries.count >= maxWindows {
                break
            }
        }
        return entries
    }

    /// The windows to open at start: none when the app was started on a folder, or the setting is off (then only
    /// the first window's folders open, in the first window).
    public static func plan(_ value: Any?, reopenWindows: Bool, launchedOnFolder: Bool) -> [Entry] {
        if launchedOnFolder {
            return []
        }
        let entries = parse(value)
        return reopenWindows ? entries : Array(entries.prefix(1)).map {
            Entry(folders: $0.folders, workspaceFile: $0.workspaceFile)
        }
    }

    /// Whether a window at `bounds` can be grabbed on one of `screens` (same coordinates): monitors change between
    /// runs.
    public static func onScreen(_ bounds: CGRect, screens: [CGRect]) -> Bool {
        screens.contains { screen in
            let left = max(bounds.minX, screen.minX)
            let right = min(bounds.maxX, screen.maxX)
            let top = max(bounds.minY, screen.minY)
            let bottom = min(bounds.minY + grabHeight, screen.maxY)
            return right - left >= grabWidth && bottom - top >= grabHeight / 2
        }
    }

    private static func bounds(_ value: Any?) -> CGRect? {
        guard let object = value as? [String: Any] else {
            return nil
        }
        let number = { (key: String) -> Double? in
            (object[key] as? NSNumber).map(\.doubleValue).flatMap { $0.isFinite ? $0 : nil }
        }
        guard let x = number("x"), let y = number("y"), let width = number("width"), let height = number("height")
        else {
            return nil
        }
        let sizeOK = (minSize.width...maxSize).contains(width) && (minSize.height...maxSize).contains(height)
        let positionOK = abs(x) <= maxSize * 4 && abs(y) <= maxSize * 4
        return sizeOK && positionOK ? CGRect(x: x, y: y, width: width, height: height) : nil
    }
}
