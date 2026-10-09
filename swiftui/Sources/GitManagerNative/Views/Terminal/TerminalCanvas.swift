// The terminal's canvas inside the panel's body (TerminalView.svelte; TerminalPanel draws the --editor-bg and the
// viewport's --term-background in SwiftUI, measured like the rest of the window). The canvas is shown the way WebKit
// shows the page's WebGL canvas: a layer of the CSS size (the device size halved, rounded) holding the device-pixel
// sRGB image, stretched to it with linear filtering, so macOS composites the same bytes the same way.

import AppKit
import Combine
import NativeCore
import SwiftUI

struct TerminalCanvas: NSViewRepresentable {
    @ObservedObject var store: TerminalStore
    let theme: Theme

    func makeNSView(context: Context) -> TerminalCanvasView {
        TerminalCanvasView()
    }

    func updateNSView(_ view: TerminalCanvasView, context: Context) {
        view.store = store
        view.session = store.session
        view.apply(theme: theme)
        view.redraw()
        if view.focusRequests != store.focusRequests {
            view.focusRequests = store.focusRequests
            DispatchQueue.main.async {
                view.window?.makeFirstResponder(view)
            }
        }
    }
}

final class TerminalCanvasView: NSView {
    /// xterm.js's FitAddon leaves room for its 14-point scrollbar.
    static let scrollbarWidth: CGFloat = 14
    static let padding = NSEdgeInsets(top: 4, left: 12, bottom: 2, right: 0)

    weak var store: TerminalStore?
    var session: TerminalSession? {
        didSet {
            if session !== oldValue {
                laidOut = nil
                needsLayout = true
                // Output redraws once per main loop run (TerminalSession.changed).
                watcher = session?.$version.sink { [weak self] _ in
                    DispatchQueue.main.async {
                        self?.redraw()
                    }
                }
            }
        }
    }
    var focusRequests = 0
    private var watcher: AnyCancellable?
    private let canvas = CALayer()
    var frameModel: TerminalFrame?
    private var palette: TermPalette?
    private var paintedVersion = -1
    /// The selection while the terminal has the focus is --term-selection, else --selected-inactive.
    private var inactiveSelection: UInt32 = 0
    var selection: TermSelection? {
        didSet {
            redraw(force: true)
        }
    }
    private var laidOut: (columns: Int, rows: Int)?
    var scrollRemainder: CGFloat = 0
    private var blinkTimer: Timer?
    private var blinkOn = true
    let input = TerminalInput()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        canvas.contentsGravity = .resize
        canvas.magnificationFilter = .linear
        canvas.minificationFilter = .linear
        canvas.anchorPoint = .zero
        layer?.addSublayer(canvas)
        input.view = self
    }

    required init?(coder: NSCoder) {
        nil
    }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    func apply(theme: Theme) {
        let next = theme.terminalPalette
        guard next != palette else {
            return
        }
        palette = next
        inactiveSelection = theme.rgb("--selected-inactive")
        // A new theme starts a new glyph cache, as xterm.js clears its atlas.
        frameModel = nil
        paintedVersion = -1
        redraw()
    }

    private func makeFrame() -> TerminalFrame {
        if let frameModel {
            return frameModel
        }
        let scale = Int((window?.backingScaleFactor ?? 2).rounded())
        let warmBase = TerminalFonts.base(systemOnly: true)
        let metrics = TerminalMetrics(
            font: warmBase, fontSize: TerminalFonts.fontSize, lineHeight: TerminalFonts.lineHeight, scale: scale
        )
        let pageBase = TerminalFonts.base(systemOnly: false)
        let glyphs = TerminalGlyphs(
            metrics: metrics, fonts: TerminalFonts.faces(pageBase, size: metrics.deviceFontSize),
            warmFonts: TerminalFonts.faces(warmBase, size: metrics.deviceFontSize)
        )
        let made = TerminalFrame(glyphs: glyphs)
        frameModel = made
        return made
    }

    override func layout() {
        super.layout()
        guard window != nil, bounds.width > 0, bounds.height > 0 else {
            return
        }
        let metrics = makeFrame().glyphs.metrics
        let cellWidth = CGFloat(metrics.cellWidth) / CGFloat(metrics.scale)
        let cellHeight = CGFloat(metrics.cellHeight) / CGFloat(metrics.scale)
        // FitAddon.proposeDimensions: the host's whole width (padding included) less the scrollbar, its height.
        let columns = max(2, Int(((bounds.width.rounded(.down) - Self.scrollbarWidth) / cellWidth).rounded(.down)))
        let rows = max(1, Int((bounds.height.rounded(.down) / cellHeight).rounded(.down)))
        if laidOut?.columns != columns || laidOut?.rows != rows {
            laidOut = (columns, rows)
            // Not inside SwiftUI's update: starting the shell publishes the store's session.
            DispatchQueue.main.async { [weak self] in
                self?.store?.layout(columns: columns, rows: rows)
            }
        }
        redraw()
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        needsLayout = true
    }

    /// Paints the canvas when the terminal changed since the last paint.
    func redraw(force: Bool = false) {
        guard let session, let palette, window != nil else {
            return
        }
        let version = session.version &* 2 + (blinkOn ? 1 : 0)
        guard force || version != paintedVersion else {
            return
        }
        paintedVersion = version
        let frame = makeFrame()
        let focused = window?.firstResponder === self && window?.isKeyWindow == true
        frame.paint(
            session.term, palette: palette, cursor: cursor(session.term), selection: selection,
            selectionColor: focused ? palette.selection : inactiveSelection
        )
        guard frame.width > 0, frame.height > 0, let image = image(frame) else {
            return
        }
        let scale = CGFloat(frame.glyphs.metrics.scale)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        canvas.contents = image
        canvas.frame = CGRect(
            x: Self.padding.left, y: Self.padding.top,
            width: (CGFloat(frame.width) / scale).rounded(), height: (CGFloat(frame.height) / scale).rounded()
        )
        CATransaction.commit()
    }

    private func cursor(_ term: TermEmulator) -> TerminalCursor? {
        let focused = window?.firstResponder === self && window?.isKeyWindow == true
        guard term.cursorVisible, term.viewOffset == 0, !focused || blinkOn else {
            return nil
        }
        let screen = term.screen
        return TerminalCursor(
            column: min(screen.cursorX, term.columns - 1), row: screen.cursorY, shape: term.cursorShape,
            focused: focused
        )
    }

    private func image(_ frame: TerminalFrame) -> CGImage? {
        let info = CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        let data = frame.pixels.withUnsafeBufferPointer { Data(buffer: $0) }
        guard let provider = CGDataProvider(data: data as CFData),
              let space = CGColorSpace(name: CGColorSpace.sRGB) else {
            return nil
        }
        return CGImage(
            width: frame.width, height: frame.height, bitsPerComponent: 8, bitsPerPixel: 32,
            bytesPerRow: frame.width * 4, space: space, bitmapInfo: CGBitmapInfo(rawValue: info),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
        )
    }

    // MARK: Focus and the blinking cursor (600 ms, xterm's CursorBlinkStateManager)

    override func becomeFirstResponder() -> Bool {
        store?.focused = true
        restartBlink()
        return true
    }

    override func resignFirstResponder() -> Bool {
        store?.focused = false
        blinkTimer?.invalidate()
        blinkOn = true
        redraw(force: true)
        return true
    }

    func restartBlink() {
        blinkTimer?.invalidate()
        blinkOn = true
        redraw(force: true)
        guard session?.term.cursorBlink ?? true else {
            return
        }
        blinkTimer = Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else {
                    return
                }
                self.blinkOn.toggle()
                self.redraw()
            }
        }
    }

    // MARK: Input

    override func keyDown(with event: NSEvent) {
        input.keyDown(event)
    }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard window?.firstResponder === self else {
            return super.performKeyEquivalent(with: event)
        }
        return input.keyEquivalent(event) || super.performKeyEquivalent(with: event)
    }
}
