// UTF-8 decoding for the terminal that survives a sequence split between two reads of the shell's output; a bad
// sequence becomes U+FFFD, as in xterm.js's Utf8ToUtf32.

struct UTF8Decoder {
    private var value: UInt32 = 0
    private var needed = 0
    private var minimum: UInt32 = 0

    var isIdle: Bool { needed == 0 }

    mutating func push(_ byte: UInt8, into out: inout [Unicode.Scalar]) {
        if needed > 0 {
            if byte & 0xC0 == 0x80 {
                value = (value << 6) | UInt32(byte & 0x3F)
                needed -= 1
                if needed == 0 {
                    let valid = value >= minimum && !(0xD800...0xDFFF).contains(value)
                    out.append(valid ? Unicode.Scalar(value) ?? "\u{FFFD}" : "\u{FFFD}")
                }
                return
            }
            // The broken sequence is replaced, and this byte starts over.
            needed = 0
            out.append("\u{FFFD}")
        }
        switch byte {
        case 0x00...0x7F:
            out.append(Unicode.Scalar(byte))
        case 0xC2...0xDF:
            (value, needed, minimum) = (UInt32(byte & 0x1F), 1, 0x80)
        case 0xE0...0xEF:
            (value, needed, minimum) = (UInt32(byte & 0x0F), 2, 0x800)
        case 0xF0...0xF4:
            (value, needed, minimum) = (UInt32(byte & 0x07), 3, 0x10000)
        default:
            out.append("\u{FFFD}")
        }
    }
}
