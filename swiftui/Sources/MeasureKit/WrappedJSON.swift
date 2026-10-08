// JSON written within a line width: values that fit stay on one line, objects pack their "key": value pairs
// onto shared lines, and only what does not fit is broken up. Keys are sorted, so output is stable in git.

import Foundation

public enum WrappedJSON {
    /// The lines of `value` as JSON, each at most `width` columns unless one string alone is longer.
    public static func lines(_ value: Any, width: Int = 120, indent: Int = 0) throws -> [String] {
        try render(value, indent: indent, width: width, prefix: "")
    }

    public static func string(_ value: Any, width: Int = 120) throws -> String {
        try lines(value, width: width).joined(separator: "\n") + "\n"
    }

    static func compact(_ value: Any) throws -> String {
        let options: JSONSerialization.WritingOptions = [.fragmentsAllowed, .sortedKeys, .withoutEscapingSlashes]
        let data = try JSONSerialization.data(withJSONObject: value, options: options)
        // JSONSerialization writes "a":1; a space after colons and commas reads better and matches the rest.
        return spaced(String(decoding: data, as: UTF8.self))
    }

    /// Adds a space after the colons and commas that separate JSON items, leaving strings alone.
    private static func spaced(_ text: String) -> String {
        var out = ""
        var inString = false
        var escaped = false
        for character in text {
            out.append(character)
            if inString {
                if escaped {
                    escaped = false
                } else if character == "\\" {
                    escaped = true
                } else if character == "\"" {
                    inString = false
                }
            } else if character == "\"" {
                inString = true
            } else if character == ":" || character == "," {
                out.append(" ")
            }
        }
        return out
    }

    /// `prefix` ("\"key\": ") goes before the value on its first line.
    private static func render(_ value: Any, indent: Int, width: Int, prefix: String) throws -> [String] {
        let pad = String(repeating: " ", count: indent)
        let flat = try compact(value)
        if pad.count + prefix.count + flat.count <= width {
            return [pad + prefix + flat]
        }
        if let object = value as? [String: Any], !object.isEmpty {
            var items: [[String]] = []
            for key in object.keys.sorted() {
                guard let item = object[key] else {
                    continue
                }
                items.append(try render(item, indent: indent + 2, width: width, prefix: try compact(key) + ": "))
            }
            return [pad + prefix + "{"] + pack(items, indent: indent + 2, width: width) + [pad + "}"]
        }
        if let array = value as? [Any], !array.isEmpty {
            let items = try array.map { try render($0, indent: indent + 2, width: width, prefix: "") }
            return [pad + prefix + "["] + pack(items, indent: indent + 2, width: width) + [pad + "]"]
        }
        return [pad + prefix + flat]
    }

    /// Joins the items with commas, putting one-line items side by side while they fit.
    private static func pack(_ items: [[String]], indent: Int, width: Int) -> [String] {
        let pad = String(repeating: " ", count: indent)
        var lines: [String] = []
        var current = ""
        for (index, item) in items.enumerated() {
            let last = index == items.count - 1
            if item.count == 1 {
                let text = String(item[0].dropFirst(indent)) + (last ? "" : ",")
                if current.isEmpty {
                    current = pad + text
                } else if current.count + 1 + text.count <= width {
                    current += " " + text
                } else {
                    lines.append(current)
                    current = pad + text
                }
                continue
            }
            if !current.isEmpty {
                lines.append(current)
                current = ""
            }
            lines += item.dropLast()
            lines.append(item[item.count - 1] + (last ? "" : ","))
        }
        if !current.isEmpty {
            lines.append(current)
        }
        return lines
    }
}
