// Draws what is on screen of a file, and nothing else, like DiffCanvas: one view the size of the editor's scroller
// that paints the rows crossing it from the scroll offset, so a long file costs no more memory than a short one.
// The pixels are layers as the current app's page has them (CanvasSurface.swift): the view's own bitmap holds the
// editor's background, the scroller's content (selections, the active line, highlights, code text, indent guides
// and the blame note) is a see-through layer over it with the opaque gutter drawn over the code, and the cursors
// and the scrollbar thumbs are layers of their own (FileCanvasLayers.swift). Rows are lines, a folded block one row
// (FoldLayout). An edit repaints the rows it touches; the sizes are EditorGeometry's.

import AppKit
import NativeCore

final class FileCanvas: NSView {
    struct Content {
        var path: String
        /// The session's revision (any change) and its text-and-folds revision (what the guides follow).
        var revision: Int
        var docRevision: Int
        var state: EditorState
        var colors: SyntaxColors?
        var foldRanges: FoldRanges
        var marks: [LineMark]
        var blameLabel: String?
        var theme: Theme
        /// The editor has the keyboard focus: its cursors show.
        var focused: Bool
        var language: String
        var indentSize: Int
        /// The cursor's blink ("blink" or "solid", Settings > Editor > Cursor blinking).
        var blinking: String
        let layout: FoldLayout
        let geometry: EditorGeometry
        /// The blame by line, for the blame gutter (nil before the blame answers or while the gutter is off).
        var blame: BlameLines?

        @MainActor
        init(session: EditorSession, blameLabel: String?, theme: Theme, focused: Bool, blinking: String,
             blameGutter: Bool = false) {
            path = session.file.path
            revision = session.revision
            docRevision = session.docRevision
            state = session.state
            colors = session.colors
            foldRanges = session.foldRanges
            marks = session.marks
            self.blameLabel = blameLabel
            self.theme = theme
            self.focused = focused
            language = session.file.language
            indentSize = session.file.indent?.size ?? 2
            self.blinking = blinking
            layout = FoldLayout(folds: session.state.folds, doc: session.state.doc)
            var geometry = EditorGeometry(lineCount: session.state.doc.lineCount,
                                          widestLine: session.state.doc.widestLine, advance: CodeLineText.advance,
                                          rowCount: layout.rowCount)
            geometry.blameWidth = blameGutter ? BlameGutter.width : 0
            self.geometry = geometry
            blame = blameGutter ? session.blame : nil
        }

        var doc: TextDocument {
            state.doc
        }

        /// True when `other` paints the same pixels.
        func drawsLike(_ other: Content) -> Bool {
            path == other.path && revision == other.revision && theme.id == other.theme.id
                && focused == other.focused && blameLabel == other.blameLabel && blinking == other.blinking
                && geometry.blameWidth == other.geometry.blameWidth && blame == other.blame
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
            dirtyRows = repaintRows(from: oldValue, to: content)
            needsDisplay = true
        }
    }

    /// Rows to paint again for a change: every row on screen (nil). Only the rows crossing the canvas are ever
    /// painted, so a full repaint after an edit stays as cheap as a scroll step.
    private func repaintRows(from old: Content?, to new: Content?) -> IndexSet? {
        nil
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
    /// One layer per cursor, made as more cursors show.
    var cursorSurfaces: [CanvasSurface] = []
    /// The vertical and the horizontal scrollbar thumb.
    let thumbSurfaces = [CanvasSurface(), CanvasSurface()]
    var paintedOffset: CGFloat?
    /// Rows to paint again at the next paint (nil: all on screen).
    var dirtyRows: IndexSet?
    /// The cursors' positions the blink last started at: a move restarts it, a scroll does not.
    var blinkKey = ""
    var guideCache: (key: String, runs: [IndentGuides.Run])?
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
        for surface in [surface] + thumbSurfaces {
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

    /// Where the main cursor line's blame note ends, from the content's left edge (it widens what scrolls sideways).
    func noteEnd(_ content: Content) -> CGFloat {
        guard let label = content.blameLabel else {
            return 0
        }
        let row = content.layout.row(forLine: content.doc.lineAt(content.state.selection.main.head).index)
        return noteX(rowWidth: rowWidth(content, row: row)) + ExactText.width(label, font: noteFont)
    }

    /// The note's left edge from the content's left edge: 36 points after the line's end (inlineBlameLayout.ts).
    func noteX(rowWidth: CGFloat) -> CGFloat {
        EditorGeometry.linePadding.left + rowWidth + 36
    }

    /// The text's left edge in canvas points.
    func textX(_ content: Content) -> CGFloat {
        CGFloat(content.geometry.guttersWidth) + EditorGeometry.linePadding.left - offsetX
    }

    /// The top of row `row` in canvas points: a point lower for each fold row at or above it (FoldLayout).
    func rowTop(_ row: Int) -> CGFloat {
        let folds = CGFloat(content?.layout.foldRows(through: row) ?? 0)
        return CGFloat(EditorGeometry.topPadding) + CGFloat(row) * CGFloat(EditorGeometry.lineHeight) + folds - offset
    }

    /// The extra height of row `row` above its rowTop: 1 for a row with a fold placeholder, whose line block on the
    /// page is 17 points with its text at the bottom (the gutter's number stays at the block's top), else 0.
    func blockExtra(_ row: Int) -> CGFloat {
        guard let layout = content?.layout else {
            return 0
        }
        return layout.foldRows(through: row) > layout.foldRows(through: row - 1) ? 1 : 0
    }

    /// The rows crossing canvas points `top` to `bottom`, with `spill` points of margin.
    func rows(_ content: Content, from top: CGFloat, to bottom: CGFloat, spill: CGFloat = 24) -> Range<Int> {
        let height = CGFloat(EditorGeometry.lineHeight), padding = CGFloat(EditorGeometry.topPadding)
        // Fold rows push the rows below them down, so the first row on screen can be up to their count earlier.
        let folds = content.layout.groups.count
        let first = max(0, Int(((top + offset - padding - spill) / height).rounded(.down)) - folds)
        let last = min(content.layout.rowCount, Int(((bottom + offset - padding + spill) / height).rounded(.up)) + 1)
        return first < last ? first..<last : 0..<0
    }

    /// The row at canvas y, clamped to the document.
    func row(at y: CGFloat, _ content: Content) -> Int {
        let height = CGFloat(EditorGeometry.lineHeight)
        var row = min(max(0, Int(((y + offset - CGFloat(EditorGeometry.topPadding)) / height).rounded(.down))),
                      content.layout.rowCount - 1)
        // Fold rows push the rows below them down: step back while the row starts below y.
        while row > 0 && rowTop(row) > y {
            row -= 1
        }
        return row
    }
}
