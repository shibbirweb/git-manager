// The merge tool's word marks over whole lines of text (MergePaneRows): the word at an offset and its whole-word
// occurrences in a line, with the same word characters as the file editor's highlight (WordMatches.swift).

extension WordMatches {
    /// The word around `offset` in `line` (state.wordAt), or nil when the cursor touches none.
    public static func word(at offset: Int, in line: String) -> String? {
        let units = Array(line.utf16)
        guard offset >= 0, offset <= units.count, let range = word(in: units, at: offset) else {
            return nil
        }
        return String(utf16CodeUnits: Array(units[range]), count: range.count)
    }

    /// Every occurrence of `word` in `line` with no word character just before or after it.
    public static func ranges(of word: String, in line: String) -> [Range<Int>] {
        let units = Array(line.utf16), target = Array(word.utf16)
        guard !target.isEmpty, units.count >= target.count else {
            return []
        }
        var found: [Range<Int>] = []
        var index = 0
        while index + target.count <= units.count {
            if units[index..<(index + target.count)].elementsEqual(target) {
                let before = index == 0 || !isWord(units[index - 1])
                let after = index + target.count == units.count || !isWord(units[index + target.count])
                if before && after {
                    found.append(index..<(index + target.count))
                    index += target.count
                    continue
                }
            }
            index += 1
        }
        return found
    }
}
