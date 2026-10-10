// How long a toast stays and what the status bar's bell shows (src/lib/ui/toast.svelte.ts,
// src/lib/notifications/notificationModel.ts).

import Foundation

public enum Notices {
    public enum Kind: String, Sendable {
        case info, success, warning, error
    }

    /// Seconds on screen: errors 9, warnings 6, others 3.5; a toast with a button (Undo) 8.
    public static func timeout(_ kind: Kind, hasAction: Bool) -> Double {
        if hasAction {
            return 8
        }
        switch kind {
        case .error:
            return 9
        case .warning:
            return 6
        case .info, .success:
            return 3.5
        }
    }

    /// The bell counts unread errors and warnings only.
    public static func countsAsAlert(_ kind: Kind) -> Bool {
        kind == .error || kind == .warning
    }

    public static func badgeText(_ count: Int) -> String {
        if count <= 0 {
            return ""
        }
        return count > 99 ? "99+" : String(count)
    }

    /// A toast's detail: trimmed, and none when only whitespace is left.
    public static func detail(_ text: String?) -> String? {
        let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}
