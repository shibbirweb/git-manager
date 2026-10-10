// The terminal's canvas as the current app's WebGL renderer fills it (WebglRenderer, RectangleRenderer,
// GlyphRenderer): the theme background, each cell's own background, the characters from the glyph cache placed at
// their cell (a glyph may spill into its neighbors), then the cursor. The result is the same 8-bit sRGB bytes as the
// page's canvas, which a layer then shows the way WebKit shows its canvas (TerminalCanvas.swift).

import CoreGraphics
import NativeCore

struct TerminalCursor: Equatable {
    var column: Int
    var row: Int
    var shape: TermCursorShape
    /// Focused: a filled block (or the shape); unfocused: an outline.
    var focused: Bool
}

final class TerminalFrame {
    let glyphs: TerminalGlyphs
    private(set) var columns = 0
    private(set) var rows = 0
    private(set) var pixels: [UInt32] = []

    var width: Int { columns * glyphs.metrics.cellWidth }
    var height: Int { rows * glyphs.metrics.cellHeight }

    init(glyphs: TerminalGlyphs) {
        self.glyphs = glyphs
    }

    /// Paints every visible row of `term` in `palette`, with the cursor when it shows and the selection's cells on
    /// `selectionColor` (xterm.js's CellColorResolver).
    func paint(
        _ term: TermEmulator, palette: TermPalette, cursor: TerminalCursor?, selection: TermSelection? = nil,
        selectionColor: UInt32 = 0
    ) {
        let metrics = glyphs.metrics
        if columns != term.columns || rows != term.rows {
            columns = term.columns
            rows = term.rows
            pixels = [UInt32](repeating: 0, count: width * height)
        }
        let width = self.width
        let themeBackground = Self.opaque(palette.background)
        for index in pixels.indices {
            pixels[index] = themeBackground
        }
        let block = cursor.flatMap { $0.shape == .block && $0.focused ? $0 : nil }
        for row in 0..<rows {
            let line = term.visibleLine(row)
            for column in 0..<min(columns, line.cells.count) {
                let cell = line.cells[column]
                var background = palette.background(cell.style)
                if selection?.contains(line: term.viewTop + row, column: column) == true {
                    background = selectionColor
                }
                if block?.row == row && block?.column == column {
                    background = palette.cursor
                }
                if background != palette.background {
                    let cellWidth = metrics.cellWidth * max(1, cell.width)
                    fill(x: column * metrics.cellWidth, y: row * metrics.cellHeight, width: cellWidth,
                         height: metrics.cellHeight, color: background, stride: width)
                }
            }
        }
        for row in 0..<rows {
            let line = term.visibleLine(row)
            for column in 0..<min(columns, line.cells.count) {
                let cell = line.cells[column]
                guard cell.width > 0, !cell.isEmpty, !cell.style.isInvisible || cell.style.isUnderline else {
                    continue
                }
                let text = line.combined[column] ?? cell.character.map(String.init) ?? " "
                let onCursor = block?.row == row && block?.column == column
                let selected = selection?.contains(line: term.viewTop + row, column: column) == true
                var background = selected ? selectionColor : palette.background(cell.style)
                var foreground = palette.foreground(
                    cell.style, glyph: cell.scalar, on: selected ? selectionColor : nil
                )
                if onCursor {
                    foreground = TermRGBA(rgb: palette.background)
                    background = palette.cursor
                }
                if text == " " && !cell.style.isUnderline && !cell.style.isStrikethrough && !cell.style.isOverline {
                    continue
                }
                let key = TerminalGlyphKey(
                    text: cell.style.isInvisible ? " " : text, foreground: foreground, background: background,
                    bold: cell.style.isBold, italic: cell.style.isItalic, underline: cell.style.isUnderline,
                    strikethrough: cell.style.isStrikethrough, overline: cell.style.isOverline, cells: cell.width,
                    warm: !onCursor && !selected && cell.style == .plain && (33...125).contains(cell.scalar)
                        && line.combined[column] == nil
                )
                place(glyphs.glyph(key), x: column * metrics.cellWidth, y: row * metrics.cellHeight, stride: width)
            }
        }
        if let cursor, block == nil {
            paintCursor(cursor, palette: palette, stride: width)
        }
    }

    /// Bar, underline and the unfocused outline, drawn over the text (RectangleRenderer.updateCursor).
    private func paintCursor(_ cursor: TerminalCursor, palette: TermPalette, stride: Int) {
        let metrics = glyphs.metrics
        let left = cursor.column * metrics.cellWidth, top = cursor.row * metrics.cellHeight
        let pixel = metrics.scale
        if !cursor.focused {
            fill(x: left, y: top, width: pixel, height: metrics.cellHeight, color: palette.cursor, stride: stride)
            fill(x: left, y: top + metrics.cellHeight - pixel, width: metrics.cellWidth, height: pixel,
                 color: palette.cursor, stride: stride)
            fill(x: left, y: top, width: metrics.cellWidth, height: pixel, color: palette.cursor, stride: stride)
            fill(x: left + metrics.cellWidth - pixel, y: top, width: pixel, height: metrics.cellHeight,
                 color: palette.cursor, stride: stride)
        } else if cursor.shape == .bar {
            fill(x: left, y: top, width: pixel, height: metrics.cellHeight, color: palette.cursor, stride: stride)
        } else if cursor.shape == .underline {
            fill(x: left, y: top + metrics.cellHeight - pixel, width: metrics.cellWidth, height: pixel,
                 color: palette.cursor, stride: stride)
        }
    }

    private func fill(x: Int, y: Int, width: Int, height: Int, color: UInt32, stride: Int) {
        let value = Self.opaque(color)
        let right = min(x + width, self.width), bottom = min(y + height, self.height)
        guard x < right, y < bottom else {
            return
        }
        for row in max(0, y)..<bottom {
            let start = row * stride
            for column in max(0, x)..<right {
                pixels[start + column] = value
            }
        }
    }

    /// Copies a glyph's opaque pixels; its cleared ones leave what is under them.
    private func place(_ glyph: TerminalGlyph, x: Int, y: Int, stride: Int) {
        guard glyph.width > 0 else {
            return
        }
        let left = x + glyph.originX, top = y + glyph.originY
        for row in 0..<glyph.height {
            let targetRow = top + row
            guard targetRow >= 0 && targetRow < height else {
                continue
            }
            let source = row * glyph.width, target = targetRow * stride
            for column in 0..<glyph.width {
                let pixel = glyph.pixels[source + column]
                let targetColumn = left + column
                if pixel != 0 && targetColumn >= 0 && targetColumn < width {
                    pixels[target + targetColumn] = pixel
                }
            }
        }
    }

    /// BGRA in a little-endian word, opaque.
    static func opaque(_ rgb: UInt32) -> UInt32 {
        0xFF00_0000 | (rgb & 0xFF_FFFF)
    }
}
