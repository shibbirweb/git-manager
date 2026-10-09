// The control server's search actions, the native side of what gm-measure does in the current app with
// run_menu_command: `quick_open` (prefix "" for Go to File, ">" for the Command Palette; `recentFiles`, paths
// relative to the folder, oldest first, stand for files opened before),
// `search` (Find in Files with `query`, selected, as the current app starts it from the editor's selection) and
// `close_dialog` (like Escape). Each answers once the popup shows its rows: the kind, the text, the status and the
// rows' keys.

import Foundation
import NativeCore

extension Control {
    static func search(_ action: String, _ args: [String: Any]) -> String {
        switch action {
        case "quick_open":
            let prefix = args["prefix"] as? String ?? ""
            let recentFiles = args["recentFiles"] as? [String] ?? []
            onMain {
                let popups = SearchPopups.shared
                for filePath in recentFiles {
                    let root = popups.roots.first ?? ""
                    RecentFiles.shared.opened(filePath.hasPrefix("/") ? filePath : "\(root)/\(filePath)")
                }
                popups.openQuickOpen(prefix)
            }
        case "search":
            let query = args["query"] as? String ?? ""
            onMain { SearchPopups.shared.openSearch(query) }
        default:
            onMain { SearchPopups.shared.close() }
            return reply(ok: true, structured: onMain { popupState() })
        }
        // The file index and the text search answer off the main thread; wait for their rows.
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            let settled = onMain { () -> Bool in
                let popups = SearchPopups.shared
                return popups.kind == .search ? !popups.textRunning : !popups.fileIndexing
            }
            if settled {
                break
            }
            Thread.sleep(forTimeInterval: 0.05)
        }
        Thread.sleep(forTimeInterval: 0.3)
        return reply(ok: true, structured: onMain { popupState() })
    }

    @MainActor
    static func popupState() -> [String: Any] {
        let popups = SearchPopups.shared
        let keys: [String]
        let status: String
        switch popups.kind {
        case .quickOpen:
            keys = popups.quickRows.map(\.key)
            status = popups.quickStatus
        case .search:
            keys = popups.text.rows.map(\.key)
            status = popups.textStatus
        case nil:
            keys = []
            status = ""
        }
        let kind: Any = popups.kind.map { $0 == .search ? "search" : "quickOpen" } ?? NSNull()
        return ["popup": kind, "value": popups.value, "status": status, "rows": keys, "selected": popups.selected]
    }
}
