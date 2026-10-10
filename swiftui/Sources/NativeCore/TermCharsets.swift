// The DEC Special Graphics set (ESC ( 0), which programs such as tmux, htop and dialog use for line drawing, as in
// xterm.js's Charsets.ts.

enum TermCharsets {
    static let lineDrawing: [UInt32: Unicode.Scalar] = [
        0x60: "\u{25C6}", 0x61: "\u{2592}", 0x62: "\u{2409}", 0x63: "\u{240C}", 0x64: "\u{240D}", 0x65: "\u{240A}",
        0x66: "\u{00B0}", 0x67: "\u{00B1}", 0x68: "\u{2424}", 0x69: "\u{240B}", 0x6A: "\u{2518}", 0x6B: "\u{2510}",
        0x6C: "\u{250C}", 0x6D: "\u{2514}", 0x6E: "\u{253C}", 0x6F: "\u{23BA}", 0x70: "\u{23BB}", 0x71: "\u{2500}",
        0x72: "\u{23BC}", 0x73: "\u{23BD}", 0x74: "\u{251C}", 0x75: "\u{2524}", 0x76: "\u{2534}", 0x77: "\u{252C}",
        0x78: "\u{2502}", 0x79: "\u{2264}", 0x7A: "\u{2265}", 0x7B: "\u{03C0}", 0x7C: "\u{2260}", 0x7D: "\u{00A3}",
        0x7E: "\u{00B7}",
    ]
}
