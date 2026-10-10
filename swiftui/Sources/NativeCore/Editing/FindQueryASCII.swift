// FindQuery's literal search over ASCII text, byte by byte: UTF-8 and UTF-16 offsets agree there, and the matches
// are Foundation's (ASCII case folding, the same word test), several times faster. Every change of the text or the
// cursor counts the matches of the whole file, so this is on the path of each keystroke.

extension FindQuery {
    /// The literal matches from `from` to `to` (offsets in `text`, which starts at the document's `base`), or nil
    /// when the query or the text is not all ASCII (Foundation's search then).
    func asciiMatches(_ text: String, from: Int, to: Int, limit: Int, overlapping: Bool,
                      base: Int) -> [Range<Int>]? {
        let needle = Array(search.utf8)
        guard !needle.isEmpty, needle.allSatisfy({ $0 < 0x80 }) else {
            return nil
        }
        var text = text
        return text.withUTF8 { bytes -> [Range<Int>]? in
            guard bytes.allSatisfy({ $0 < 0x80 }) else {
                return nil
            }
            let fold = !options.matchCase
            let pattern = needle.map { Self.lower($0, fold) }
            var found: [Range<Int>] = []
            var position = from
            let last = to - pattern.count
            while position <= last && found.count < limit {
                var index = 0
                while index < pattern.count && Self.lower(bytes[position + index], fold) == pattern[index] {
                    index += 1
                }
                if index == pattern.count && accepts(position..<(position + pattern.count), in: bytes, base: base) {
                    found.append((position + base)..<(position + base + pattern.count))
                    position += overlapping ? 1 : pattern.count
                } else {
                    position += 1
                }
            }
            return found
        }
    }

    private static func lower(_ byte: UInt8, _ fold: Bool) -> UInt8 {
        fold && byte >= 0x41 && byte <= 0x5A ? byte | 0x20 : byte
    }

    private func accepts(_ match: Range<Int>, in bytes: UnsafeBufferPointer<UInt8>, base: Int) -> Bool {
        if excluded.contains((match.lowerBound + base)..<(match.upperBound + base)) {
            return false
        }
        guard options.wholeWords else {
            return true
        }
        let word = { (offset: Int) -> Bool in
            guard offset >= 0 && offset < bytes.count else {
                return false
            }
            let byte = bytes[offset]
            return byte == 0x5F || (byte >= 0x30 && byte <= 0x39) || (byte | 0x20 >= 0x61 && byte | 0x20 <= 0x7A)
        }
        return !(word(match.lowerBound - 1) && word(match.lowerBound))
            && !(word(match.upperBound - 1) && word(match.upperBound))
    }
}
