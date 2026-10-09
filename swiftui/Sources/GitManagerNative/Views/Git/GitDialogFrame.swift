// The frame of the Git menu's dialogs (src/lib/views/git/GitDialogFrame.svelte): the window dimmed by --overlay, the
// dialog `width` wide (at most the window less 32) at 10% of the height from the top, its shadow in the overlay
// (DialogBackdrop); 18 by 20 points of padding (16 at the bottom) inside the 1-point border, the 14-point semibold
// title 12 above the body, whose parts are 10 apart, and 16 points lower the buttons at the right, 8 apart. Escape
// cancels and Cmd+Return runs the main action, in this window only.

import AppKit
import SwiftUI

struct GitDialogFrame<Content: View, Footer: View>: View {
    @Environment(\.theme) private var theme
    @Environment(\.windowContext) private var windowContext

    let title: String
    var width: CGFloat = 520
    /// False while working: Escape and the overlay do not close it then.
    var closable = true
    let onCancel: () -> Void
    /// Cmd+Return; nil when there is no main action.
    var onSubmit: (() -> Void)?
    /// The footer sets its own spaces (a button at the left, as the result dialogs' Copy Link).
    var footerSpaced = false
    @ViewBuilder let content: () -> Content
    @ViewBuilder let footer: () -> Footer

    @State private var dialogFrame: CGRect = .zero
    @State private var keys = DialogKeys()

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                DialogBackdrop(dialog: dialogFrame, cornerRadius: 10, overlayAlpha: theme.alpha("--overlay"),
                               shadow: DialogBackdrop.parseShadow(theme.raw("--shadow") ?? ""), shadowInOverlay: true)
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if closable {
                            onCancel()
                        }
                    }
                dialog
                    .frame(width: min(width, proxy.size.width - 32))
                    .background(GeometryReader { box in
                        let frame = box.frame(in: .named("gitDialog"))
                        Color.clear
                            .onAppear { dialogFrame = frame }
                            .onChange(of: frame) { dialogFrame = $0 }
                    })
                    .padding(.top, proxy.size.height * 0.1)
            }
            .coordinateSpace(name: "gitDialog")
        }
        .onAppear {
            keys.start(window: windowContext?.window) { submit in
                if submit {
                    onSubmit?()
                } else if closable {
                    onCancel()
                }
                return submit ? onSubmit != nil : closable
            }
        }
        .onDisappear {
            keys.stop()
        }
    }

    private var dialog: some View {
        VStack(alignment: .leading, spacing: 0) {
            ExactText(text: title, size: 14, weight: .semibold)
                .foregroundStyle(theme.ink("--text"))
                .padding(.bottom, 12)
            VStack(alignment: .leading, spacing: 10) {
                content()
            }
            HStack(spacing: 8) {
                if !footerSpaced {
                    Spacer(minLength: 0)
                }
                footer()
            }
            .padding(.top, 16)
        }
        // The 1-point border is outside the 18 / 20 / 16 points of padding.
        .padding(.top, 19)
        .padding(.horizontal, 21)
        .padding(.bottom, 17)
        .background(RoundedRectangle(cornerRadius: 10, style: .circular).fill(theme.color("--panel")))
        .borderRing(theme.color("--border-strong"), cornerRadius: 10)
    }
}

/// Escape and Cmd+Return for a dialog, from its own window only.
@MainActor
final class DialogKeys {
    private var monitor: Any?

    /// `handle(true)` for Cmd+Return, `handle(false)` for Escape; it answers whether the key was used.
    func start(window: NSWindow?, handle: @escaping (Bool) -> Bool) {
        stop()
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak window] event in
            guard event.window === window else {
                return event
            }
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            let used = MainActor.assumeIsolated { () -> Bool in
                if event.keyCode == 53 {
                    return handle(false)
                }
                if (event.keyCode == 36 || event.keyCode == 76) && (flags == .command || flags == .control) {
                    return handle(true)
                }
                return false
            }
            return used ? nil : event
        }
    }

    func stop() {
        if let monitor {
            NSEvent.removeMonitor(monitor)
        }
        monitor = nil
    }
}
