// Which window already shows a folder or a workspace (src-tauri/src/windows.rs Shown and WindowBook::owner):
// opening it again focuses that window instead. Paths are compared canonical (the caller resolves symlinks and
// ".."). New windows sit down and right of the one they came from (cascade).

import Foundation

public enum WindowOwnership {
    /// What a window shows: its folders, or a workspace file and its folders.
    public struct Shown: Equatable, Sendable {
        public let folders: [String]
        public let workspaceFile: String?

        public init(folders: [String], workspaceFile: String? = nil) {
            var unique: [String] = []
            for folder in folders where !unique.contains(folder) {
                unique.append(folder)
            }
            self.folders = unique
            self.workspaceFile = workspaceFile
        }
    }

    /// How far a new window sits from the one it was opened from, like macOS document windows.
    public static let cascadeOffset = 28.0

    /// The index in `windows` of the window that already shows `wanted`: a workspace file, the window showing that
    /// file; one folder, a window with it among its folders; several folders, a window with exactly those. Nil
    /// for nothing (a new, empty window) or when no window shows it.
    public static func owner(of wanted: Shown, in windows: [Shown]) -> Int? {
        if let file = wanted.workspaceFile {
            return windows.firstIndex { $0.workspaceFile == file }
        }
        switch wanted.folders.count {
        case 0:
            return nil
        case 1:
            return windows.firstIndex { $0.folders.contains(wanted.folders[0]) }
        default:
            return windows.firstIndex { Set($0.folders) == Set(wanted.folders) }
        }
    }

    /// The top left of a new window opened from one at `from` (screen points, y down).
    public static func cascade(from origin: CGPoint) -> CGPoint {
        CGPoint(x: origin.x + cascadeOffset, y: origin.y + cascadeOffset)
    }
}
