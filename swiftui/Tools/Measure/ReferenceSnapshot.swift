// One screen's layout snapshot: each part's visible elements, read with inspect_elements, written as
// Reference/<screen>-<mode>/<part>.json. A part too long for one file (300 lines) continues in
// <part>-2.json and so on; every line stays within 120 columns (WrappedJSON).

import Foundation
import MeasureKit

enum ReferenceSnapshot {
    static let maxLines = 300

    /// The computed styles every element records (inspect_elements reads at most 30).
    static let styles = [
        "display", "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color",
        "background-color", "opacity", "border-top-width", "border-right-width", "border-bottom-width",
        "border-left-width", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
        "border-radius", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top",
        "margin-left", "gap", "box-shadow", "text-align", "white-space", "overflow", "text-overflow",
    ]

    /// Values left out to keep the snapshots readable: a style missing there has one of these.
    static let defaultStyleValues: Set<String> = [
        "", "none", "normal", "0px", "rgba(0, 0, 0, 0)", "visible", "start", "clip", "1", "auto",
    ]

    /// Writes the screen's parts into `directory` (replacing what was there) and returns the element count.
    static func capture(
        _ app: RunningApp, screen: Reference.Screen, mode: String, version: String, into directory: String
    ) async throws -> Int {
        let files = FileManager.default
        try? files.removeItem(atPath: directory)
        try files.createDirectory(atPath: directory, withIntermediateDirectories: true)
        let about: [String: Any] = [
            "screen": screen.name,
            "mode": mode,
            "app": "Git Manager \(version)",
            "demo": "scripts/make-docs-demo.sh, acme/storefront"
                + (screen.name == "diff" ? ", diff of \(Reference.diffFile)" : ""),
            "note": "Visible elements only; styles with a default value are left out (ReferenceSnapshot.swift).",
        ]
        var total = 0
        for part in screen.parts {
            let elements = try await read(app, part: part)
            total += elements.count
            let slug = part.name.replacingOccurrences(of: " ", with: "-")
            let pieces = try split(elements) { chunk, piece, pieceCount in
                var file = about
                file["part"] = part.name
                file["selector"] = part.selector
                file["limit"] = part.limit
                file["piece"] = "\(piece) of \(pieceCount)"
                file["elements"] = chunk
                return file
            }
            for (index, text) in pieces.enumerated() {
                let name = index == 0 ? "\(slug).json" : "\(slug)-\(index + 1).json"
                let filePath = (directory as NSString).appendingPathComponent(name)
                try text.write(toFile: filePath, atomically: true, encoding: .utf8)
            }
        }
        return total
    }

    /// The part's visible elements, without default styles and without Svelte's per-build class names.
    private static func read(_ app: RunningApp, part: Reference.Part) async throws -> [[String: Any]] {
        let answer = try await app.client.call(
            "inspect_elements", ["selector": part.selector, "styles": styles, "limit": part.limit]
        )
        if answer.isError {
            throw ToolError("inspect_elements \(part.selector): \(answer.text)")
        }
        let found = answer.structured?["elements"] as? [[String: Any]] ?? []
        return found.filter { $0["visible"] as? Bool == true }.map { element in
            var element = element
            element.removeValue(forKey: "visible")
            let text = (element["text"] as? String ?? "").split(whereSeparator: \.isWhitespace)
            element["text"] = text.joined(separator: " ")
            let classes = (element["classes"] as? String ?? "").split(separator: " ")
            element["classes"] = classes.filter { !$0.hasPrefix("svelte-") }.joined(separator: " ")
            let values = element["styles"] as? [String: String] ?? [:]
            element["styles"] = values.filter { !defaultStyleValues.contains($0.value) }
            return element
        }
    }

    /// The elements as file texts of at most `maxLines` lines each; `wrap` builds the file around a piece.
    private static func split(
        _ elements: [[String: Any]], wrap: ([[String: Any]], Int, Int) -> [String: Any]
    ) throws -> [String] {
        var chunks: [[[String: Any]]] = [[]]
        for element in elements {
            let candidate = (chunks.last ?? []) + [element]
            let lines = try WrappedJSON.lines(wrap(candidate, 1, 1)).count
            if lines > maxLines && !(chunks.last ?? []).isEmpty {
                chunks.append([element])
            } else {
                chunks[chunks.count - 1] = candidate
            }
        }
        return try chunks.enumerated().map { index, chunk in
            try WrappedJSON.string(wrap(chunk, index + 1, chunks.count))
        }
    }
}
