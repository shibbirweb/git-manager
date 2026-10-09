// One terminal cell, packed like xterm.js's buffer (three 32-bit words), so the scrollback costs what it costs in the
// current app: the character with its width, and the foreground and background words with xterm's flag bits.

public enum TermColorMode: UInt32, Sendable {
    case standard = 0
    /// One of the 16 theme colors.
    case palette16 = 1
    /// One of the 256 colors (16 theme colors, the 6 x 6 x 6 cube and 24 grays).
    case palette256 = 2
    case rgb = 3
}

/// A cell's colors and styles: xterm's `fg` and `bg` words (src/common/buffer/Constants.ts).
public struct TermStyle: Equatable, Hashable, Sendable {
    public var fg: UInt32
    public var bg: UInt32

    public static let plain = TermStyle(fg: 0, bg: 0)

    static let colorMask: UInt32 = 0xFF_FFFF
    static let modeShift: UInt32 = 24
    static let modeMask: UInt32 = 0x300_0000
    // fg flags
    static let inverse: UInt32 = 0x400_0000
    static let bold: UInt32 = 0x800_0000
    static let underline: UInt32 = 0x1000_0000
    static let blink: UInt32 = 0x2000_0000
    static let invisible: UInt32 = 0x4000_0000
    static let strikethrough: UInt32 = 0x8000_0000
    // bg flags
    static let italic: UInt32 = 0x400_0000
    static let dim: UInt32 = 0x800_0000
    static let overline: UInt32 = 0x4000_0000

    public init(fg: UInt32, bg: UInt32) {
        self.fg = fg
        self.bg = bg
    }

    public var fgMode: TermColorMode { TermColorMode(rawValue: (fg & Self.modeMask) >> Self.modeShift) ?? .standard }
    public var bgMode: TermColorMode { TermColorMode(rawValue: (bg & Self.modeMask) >> Self.modeShift) ?? .standard }
    public var fgColor: UInt32 { fg & Self.colorMask }
    public var bgColor: UInt32 { bg & Self.colorMask }
    public var isBold: Bool { fg & Self.bold != 0 }
    public var isInverse: Bool { fg & Self.inverse != 0 }
    public var isUnderline: Bool { fg & Self.underline != 0 }
    public var isInvisible: Bool { fg & Self.invisible != 0 }
    public var isStrikethrough: Bool { fg & Self.strikethrough != 0 }
    public var isItalic: Bool { bg & Self.italic != 0 }
    public var isDim: Bool { bg & Self.dim != 0 }
    public var isOverline: Bool { bg & Self.overline != 0 }

    public mutating func setForeground(_ mode: TermColorMode, _ color: UInt32) {
        fg = (fg & ~(Self.modeMask | Self.colorMask)) | (mode.rawValue << Self.modeShift) | (color & Self.colorMask)
    }

    public mutating func setBackground(_ mode: TermColorMode, _ color: UInt32) {
        bg = (bg & ~(Self.modeMask | Self.colorMask)) | (mode.rawValue << Self.modeShift) | (color & Self.colorMask)
    }

    mutating func setFlag(fg flag: UInt32, _ on: Bool) {
        fg = on ? fg | flag : fg & ~flag
    }

    mutating func setFlag(bg flag: UInt32, _ on: Bool) {
        bg = on ? bg | flag : bg & ~flag
    }

    /// What an erase leaves: only the background color survives (xterm's eraseAttrData).
    var erased: TermStyle {
        TermStyle(fg: 0, bg: bg & (Self.modeMask | Self.colorMask))
    }
}

public struct TermCell: Equatable, Sendable {
    /// The Unicode scalar in the low 21 bits and the width (0, 1 or 2) above them. 0 is an empty cell; width 0 is
    /// the right half of a wide character.
    var content: UInt32
    public var style: TermStyle

    static let widthShift: UInt32 = 22

    public static let empty = TermCell(content: 1 << widthShift, style: .plain)

    init(content: UInt32, style: TermStyle) {
        self.content = content
        self.style = style
    }

    public init(scalar: UInt32, width: Int, style: TermStyle) {
        content = scalar | (UInt32(width) << Self.widthShift)
        self.style = style
    }

    static func blank(_ style: TermStyle) -> TermCell {
        TermCell(content: 1 << widthShift, style: style)
    }

    /// 0 for an empty cell.
    public var scalar: UInt32 { content & 0x1F_FFFF }
    public var width: Int { Int(content >> Self.widthShift) }
    public var isEmpty: Bool { scalar == 0 }

    public var character: Character? {
        guard scalar != 0, let unicode = Unicode.Scalar(scalar) else {
            return nil
        }
        return Character(unicode)
    }
}
