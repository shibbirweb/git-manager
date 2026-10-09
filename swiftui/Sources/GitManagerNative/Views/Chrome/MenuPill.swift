// The pill that opens a header menu (Header.svelte's pills with contextMenu.open). The current app opens the menu at
// the click, so a pill pressed without the pointer (Accessibility) opens it where WebKit puts that click: WebKit
// hit-tests the button's center and clicks the center of the innermost element there, the pill's name (marked with
// menuPillTarget, MenuNav.simulatedClickPoint).

import AppKit
import NativeCore
import SwiftUI

/// A header pill that opens a context menu.
struct MenuPill<Label: View>: View {
    @Environment(\.windowContext) private var windowContext
    /// What Accessibility reads, as the page's button title.
    let title: String
    /// Read when pressed; the branch menu reads the branches first.
    let items: () async -> [MenuItem]
    @ViewBuilder let label: () -> Label

    @State private var pageFrame = CGRect.zero
    @State private var windowFrame = CGRect.zero
    @State private var targetFrame: CGRect?

    var body: some View {
        PillButton(action: open, label: label)
            .accessibilityLabel(title)
            .onPreferenceChange(MenuPillTargetKey.self) { targetFrame = $0 }
            .background(GeometryReader { proxy in
                let frames = [proxy.frame(in: .named(HeaderMenus.pageSpace)), proxy.frame(in: .global)]
                Color.clear
                    .onAppear { remember(frames) }
                    .onChange(of: frames) { remember($0) }
            })
    }

    private func remember(_ frames: [CGRect]) {
        pageFrame = frames[0]
        windowFrame = frames[1]
    }

    private func open() {
        guard let center = windowContext?.menus else {
            return
        }
        center.pageTop = windowFrame.minY - pageFrame.minY
        var point = MenuNav.simulatedClickPoint(targetFrame ?? pageFrame)
        // A click of the pointer opens it there; Accessibility presses come with no event of their own.
        if let event = NSApp.currentEvent, event.type == .leftMouseUp,
           ProcessInfo.processInfo.systemUptime - event.timestamp < 1,
           let height = event.window?.contentView?.bounds.height {
            let inWindow = CGPoint(x: event.locationInWindow.x, y: height - event.locationInWindow.y)
            if windowFrame.contains(inWindow) {
                point = CGPoint(x: inWindow.x.rounded(.down), y: (inWindow.y - center.pageTop).rounded(.down))
            }
        }
        Task {
            center.open(await items(), at: point)
        }
    }
}

/// The frame of the part of a MenuPill that WebKit's simulated click lands on.
struct MenuPillTargetKey: PreferenceKey {
    static var defaultValue: CGRect?

    static func reduce(value: inout CGRect?, nextValue: () -> CGRect?) {
        value = value ?? nextValue()
    }
}

extension View {
    /// Marks the pill's name as where a press without the pointer clicks.
    func menuPillTarget() -> some View {
        background(GeometryReader { proxy in
            Color.clear.preference(key: MenuPillTargetKey.self, value: proxy.frame(in: .named(HeaderMenus.pageSpace)))
        })
    }
}
