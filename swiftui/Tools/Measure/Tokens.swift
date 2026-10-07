// gm-measure tokens: writes App/Sources/Generated/, every theme's 73 color tokens exactly as the current app
// computes them (src/lib/themes/catalog.ts), so SwiftUI colors are never typed by hand. The catalog is
// TypeScript, so this runs it with Bun, the way the tool runs git and open. One small file per theme keeps
// every file within the line standard. --check fails (exit 1) when the files are out of date; CI runs it.

import Foundation
import MeasureKit

enum Tokens {
    static let generatedDir = (swiftuiDir as NSString).appendingPathComponent("App/Sources/Generated")

    /// Prints the token names and every theme with its kind and colors as JSON.
    private static let exportScript = """
        import { THEME_INDEX } from "./src/lib/themes/themeIndex.ts";
        import { themeColors } from "./src/lib/themes/catalog.ts";
        import { COLOR_TOKENS } from "./src/lib/themes/tokens.ts";
        const themes = THEME_INDEX.map((theme) => ({ ...theme, colors: themeColors(theme.id) }));
        console.log(JSON.stringify({ tokens: COLOR_TOKENS, themes }));
        """

    struct Export: Decodable {
        struct Theme: Decodable {
            let id: String
            let name: String
            let kind: String
            let colors: [String: String]?
        }

        let tokens: [String]
        let themes: [Theme]
    }

    static func run(_ arguments: [String]) throws -> Int32 {
        var arguments = arguments
        let check = arguments.contains("--check")
        arguments.removeAll { $0 == "--check" }
        guard arguments.isEmpty else {
            print(usage)
            return 2
        }
        let result = try AppLauncher.run("/usr/bin/env", ["bun", "--eval", exportScript], in: repoRoot)
        guard result.status == 0, let json = result.output.split(separator: "\n").last.map(String.init) else {
            throw ToolError("The theme export failed:\n\(result.output)")
        }
        let export = try JSONDecoder().decode(Export.self, from: Data(json.utf8))
        let wanted = try TokensRender.files(export)
        let summary = "\(export.themes.count) themes, \(export.tokens.count) tokens"
        let stale = staleFiles(keeping: Set(wanted.keys))
        let changed = wanted.filter { path, source in
            (try? String(contentsOfFile: fullPath(path), encoding: .utf8)) != source
        }
        if check {
            if changed.isEmpty && stale.isEmpty {
                print("Generated themes are up to date (\(summary)).")
                return 0
            }
            let names = (changed.keys.sorted() + stale).joined(separator: ", ")
            print("Generated themes are out of date (\(names)): run `swift run gm-measure tokens` in swiftui/.")
            return 1
        }
        for path in stale {
            try FileManager.default.removeItem(atPath: fullPath(path))
        }
        for (path, source) in changed {
            let directory = (fullPath(path) as NSString).deletingLastPathComponent
            try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
            try source.write(toFile: fullPath(path), atomically: true, encoding: .utf8)
        }
        print("Wrote \(generatedDir): \(changed.count) files changed, \(stale.count) removed (\(summary)).")
        return 0
    }

    private static func fullPath(_ relativePath: String) -> String {
        (generatedDir as NSString).appendingPathComponent(relativePath)
    }

    /// Generated Swift files the export no longer produces (a theme that was removed).
    private static func staleFiles(keeping wanted: Set<String>) -> [String] {
        guard let found = FileManager.default.enumerator(atPath: generatedDir) else {
            return []
        }
        return found.compactMap { $0 as? String }
            .filter { $0.hasSuffix(".swift") && !wanted.contains($0) }
            .sorted()
    }
}
