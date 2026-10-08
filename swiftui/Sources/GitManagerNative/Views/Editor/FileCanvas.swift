// Draws what is on screen of a file, and nothing else, like DiffCanvas: one view the size of the editor's scroller
// that paints the lines crossing it from the scroll offset, so a long file costs no more memory than a short one.
// The pixels are layers as the current app's page has them (CanvasSurface.swift): the view's own bitmap holds the
// editor's background, the scroller's content (the active line, word highlights, code text, indent guides and the
// blame note) is a see-through layer over it with the opaque gutter drawn over the code, and the cursor and the
// scrollbar thumbs are layers of their own (FileCanvasLayers.swift). The sizes are EditorGeometry's.

import AppKit
import NativeCore

final class FileCanvas: NSView {
    struct Content {
        var file: OpenFile
        var theme: Theme
        var cursor: (line: Int, column: Int)
        var blameLabel: String?

        var geometry: EditorGeometry {
            EditorGeometry(lineCount: file.lines.count, widestLine: file.widestLine, advance: CodeLineText.advance)
        }

        /// True when `other` paints the same pixels.
        func drawsLike(_ other: Content) -> Bool {
            file.path == other.file.path && file.content.version == other.file.content.version
                && file.spans == other.file.spans && theme.id == other.theme.id && cursor == other.cursor
                && blameLabel == other.blameLabel
        }
    }

    var content: Content? {
        didSet {
            if let content, let oldValue, content.drawsLike(oldValue) {
                return
            }
            if content?.theme.id != colors?.theme.id {
                colors = content.map { CanvasColors(theme: $0.theme) }
            }
            paintedOffset = nil
            needsDisplay = true
        }
    }

    /// The scroll position: the content's y at the canvas's top edge, and its x at the gutter's right edge.
    var offset: CGFloat = 0 {
        didSet {
            if offset != oldValue {
                needsDisplay = true
            }
        }
    }

    var offsetX: CGFloat = 0 {
        didSet {
            if offsetX != oldValue {
                paintedOffset = nil
                needsDisplay = true
            }
        }
    }

    let base = CanvasSurface()
    /// The scroller's content layer, see-through where nothing is painted.
    let surface = CanvasSurface()
    let cursorSurface = CanvasSurface()
    /// The vertical and the horizontal scrollbar thumb.
    let thumbSurfaces = [CanvasSurface(), CanvasSurface()]
    var paintedOffset: CGFloat?
    /// The file and cursor position the blink last started at: a move restarts it, a scroll does not.
    var blinkKey = ""
    private(set) var colors: CanvasColors?
    var paintBand = CGRect.zero
    let glyphs = GlyphCompositor()
    /// The blame note's font: the UI font at 0.9em, italic.
    let noteFont: NSFont = {
        let base = NSFont.systemFont(ofSize: 11.7)
        return NSFont(descriptor: base.fontDescriptor.withSymbolicTraits(.italic), size: 11.7) ?? base
    }()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layerContentsRedrawPolicy = .onSetNeedsDisplay
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func makeBackingLayer() -> CALayer {
        let layer = super.makeBackingLayer()
        for surface in [surface, cursorSurface] + thumbSurfaces {
            layer.addSublayer(surface.layer)
        }
        return layer
    }

    override var isFlipped: Bool {
        true
    }

    override var wantsUpdateLayer: Bool {
        true
    }

    override func updateLayer() {
        DrawStats.measure {
            paintLayers()
        }
    }

    /// The width the code shows in: the scroller less its vertical scrollbar when the content scrolls.
    var visibleWidth: CGFloat {
        guard let content else {
            return bounds.width
        }
        let scrolls = content.geometry.documentHeight(viewport: bounds.height) > bounds.height + 0.5
        return bounds.width - (scrolls ? EditorGeometry.scrollbarSize : 0)
    }

    /// The height the rows show in: the scroller less its horizontal scrollbar when the code is wider.
    var visibleHeight: CGFloat {
        guard let content else {
            return bounds.height
        }
        let wide = content.geometry.scrollsSideways(visibleWidth: visibleWidth, noteEnd: noteEnd(content))
        return bounds.height - (wide ? EditorGeometry.scrollbarSize : 0)
    }

    /// Where the cursor line's blame note ends, from the content's left edge (it widens what scrolls sideways).
    func noteEnd(_ content: Content) -> CGFloat {
        guard let label = content.blameLabel, content.file.lines.indices.contains(content.cursor.line) else {
            return 0
        }
        let length = content.file.lines[content.cursor.line].utf16.count
        return noteX(lineLength: length) + ExactText.width(label, font: noteFont)
    }

    /// The note's left edge from the content's left edge: 36 points after the line's end (inlineBlameLayout.ts).
    func noteX(lineLength: Int) -> CGFloat {
        EditorGeometry.linePadding.left + CGFloat(lineLength) * CodeLineText.advance + 36
    }

    /// The text's left edge in canvas points.
    func textX(_ content: Content) -> CGFloat {
        CGFloat(content.geometry.guttersWidth) + EditorGeometry.linePadding.left - offsetX
    }

    /// The top of 0-based `line` in canvas points.
    func lineTop(_ line: Int) -> CGFloat {
        CGFloat(EditorGeometry.topPadding) + CGFloat(line) * CGFloat(EditorGeometry.lineHeight) - offset
    }

    /// The lines crossing canvas points `top` to `bottom`, with `spill` points of margin.
    func lines(_ content: Content, from top: CGFloat, to bottom: CGFloat, spill: CGFloat = 24) -> Range<Int> {
        let height = CGFloat(EditorGeometry.lineHeight), padding = CGFloat(EditorGeometry.topPadding)
        let first = max(0, Int(((top + offset - padding - spill) / height).rounded(.down)))
        let last = min(content.file.lines.count, Int(((bottom + offset - padding + spill) / height).rounded(.up)) + 1)
        return first < last ? first..<last : 0..<0
    }

    /// The line and column under a click at `point` (canvas points), as CodeMirror's posAtCoords picks them.
    func position(at point: NSPoint) -> (line: Int, column: Int)? {
        guard let content, !content.file.lines.isEmpty else {
            return nil
        }
        let height = CGFloat(EditorGeometry.lineHeight)
        let row = Int(((point.y + offset - CGFloat(EditorGeometry.topPadding)) / height).rounded(.down))
        let line = min(max(0, row), content.file.lines.count - 1)
        let length = content.file.lines[line].utf16.count
        let column = Int(((point.x - textX(content)) / CodeLineText.advance).rounded())
        return (line, min(max(0, column), length))
    }
}
