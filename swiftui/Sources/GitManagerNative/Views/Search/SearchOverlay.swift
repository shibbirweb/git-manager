// Where the search popups show: over the whole window below the title bar, with a clear backdrop that closes the
// popup on a click outside it (.backdrop in QuickOpen.svelte and FileSearch.svelte).

import AppKit
import SwiftUI

struct SearchOverlay: View {
    @ObservedObject private var popups = SearchPopups.shared

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onAppear(perform: SearchKeys.install)
        if let kind = popups.kind {
            GeometryReader { proxy in
                ZStack(alignment: .topLeading) {
                    Color.clear
                        .contentShape(Rectangle())
                        .onTapGesture { popups.close() }
                    switch kind {
                    case .quickOpen:
                        QuickOpenView(size: proxy.size)
                    case .search:
                        SearchEverywhereView(size: proxy.size)
                    }
                }
            }
        }
    }
}

/// Cmd+P (Go to File), Shift+Cmd+P (Command Palette) and Shift+Cmd+F (Find in Files) from anywhere in the window,
/// as the current app's window shortcuts.
enum SearchKeys {
    @MainActor private static var monitor: Any?

    @MainActor
    static func install() {
        guard monitor == nil else {
            return
        }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let flags = event.modifierFlags.intersection([.command, .shift, .option, .control])
            let key = event.charactersIgnoringModifiers?.lowercased()
            let popups = SearchPopups.shared
            switch (flags, key) {
            case ([.command], "p"):
                popups.openQuickOpen("")
            case ([.command, .shift], "p"):
                popups.openQuickOpen(">")
            case ([.command, .shift], "f"):
                popups.openSearch("")
            default:
                return event
            }
            return nil
        }
    }
}
