// A rounded fill as a Core Animation layer in sRGB, which macOS converts to the display when it composites. The
// current app's Settings dialog paints its fills in a layer of its own, and a saturated one (--selected, #d4e2ff)
// comes out one step away from WebKit's own conversion there (225 green, not 226), as macOS converts it.

import AppKit
import SwiftUI

struct LayerFill: NSViewRepresentable {
    let color: CGColor
    let cornerRadius: CGFloat

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.actions = CanvasSurface.noActions
        view.layer?.cornerCurve = .circular
        return view
    }

    func updateNSView(_ view: NSView, context: Context) {
        view.layer?.backgroundColor = color
        view.layer?.cornerRadius = cornerRadius
    }
}
