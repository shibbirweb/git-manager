// What the status bar tells about the open file (src/lib/views/StatusBar.svelte): its language's name
// (src/lib/editor/languages.ts languageName) and how it indents (src/lib/editor/indentDetect.ts), so the native app
// shows "TypeScript" and "Spaces: 2" where the current app does.

import Foundation

public enum EditorInfo {
    /// The Tab size setting's default, used when a file shows no indentation to follow.
    public static let defaultTabSize = 4
    /// Lines read from the top of a file to detect its indentation.
    public static let maxDetectLines = 10_000
    private static let maxIndentSize = 8

    /// Whole file names that decide the language, lowercased.
    private static let fileNames: [String: String] = [
        "dockerfile": "dockerfile", "containerfile": "dockerfile", "gemfile": "rb", "rakefile": "rb",
        "podfile": "rb", "vagrantfile": "rb",
    ]

    /// Display names by extension (or by the key `fileNames` gives a file).
    private static let languageNames: [String: String] = [
        "js": "JavaScript", "mjs": "JavaScript", "cjs": "JavaScript", "jsx": "JavaScript JSX",
        "ts": "TypeScript", "mts": "TypeScript", "cts": "TypeScript", "tsx": "TypeScript JSX",
        "rs": "Rust", "php": "PHP", "html": "HTML", "htm": "HTML", "vue": "Vue", "svelte": "Svelte",
        "blade": "Blade", "css": "CSS", "scss": "SCSS", "less": "Less", "json": "JSON",
        "jsonc": "JSON with Comments", "lock": "JSON", "md": "Markdown", "markdown": "Markdown", "py": "Python",
        "yml": "YAML", "yaml": "YAML", "sql": "SQL", "go": "Go", "java": "Java", "kt": "Kotlin", "kts": "Kotlin",
        "swift": "Swift", "rb": "Ruby", "rake": "Ruby", "gemspec": "Ruby", "sh": "Shell Script",
        "bash": "Shell Script", "zsh": "Shell Script", "bashrc": "Shell Script", "zshrc": "Shell Script",
        "bash_profile": "Shell Script", "zprofile": "Shell Script", "zshenv": "Shell Script",
        "profile": "Shell Script", "bat": "Batch", "toml": "TOML", "xml": "XML", "xsd": "XML", "xsl": "XML",
        "xslt": "XML", "plist": "XML", "svg": "SVG", "dockerfile": "Dockerfile", "c": "C", "h": "C",
        "cpp": "C++", "cc": "C++", "cxx": "C++", "hpp": "C++", "hh": "C++", "hxx": "C++", "cs": "C#",
        "txt": "Plain Text",
    ]

    /// The status bar's language name: "Plain Text" for a file no language claims.
    public static func languageName(filePath: String) -> String {
        languageKey(filePath).flatMap { languageNames[$0] } ?? "Plain Text"
    }

    private static func languageKey(_ filePath: String) -> String? {
        let name = (filePath.split(separator: "/").last.map(String.init) ?? filePath).lowercased()
        if let key = fileNames[name] {
            return key
        }
        if name.hasPrefix("dockerfile.") {
            return "dockerfile"
        }
        guard let dot = name.lastIndex(of: ".") else {
            return nil
        }
        return String(name[name.index(after: dot)...])
    }

    public struct Indent: Equatable, Sendable {
        public let useTabs: Bool
        /// Spaces per level; nil when the file indents with tabs.
        public let size: Int?

        public init(useTabs: Bool, size: Int?) {
            self.useTabs = useTabs
            self.size = size
        }
    }

    /// Tabs when more lines start with a tab than with spaces; else the most common step by which the indentation
    /// grows from one line to the next (ties to the smaller step). Blank lines, one-space steps and lines mixing tabs
    /// and spaces are skipped; nil when the file shows no indentation.
    public static func detectIndentation<Lines: Sequence>(_ lines: Lines) -> Indent? where Lines.Element == String {
        var tabLines = 0, spaceLines = 0, read = 0
        var steps: [Int: Int] = [:]
        var previous: Int? = 0
        for line in lines {
            read += 1
            if read > maxDetectLines {
                break
            }
            var spaces = 0, tabs = 0, blank = true
            for unit in line.utf16 {
                if unit == 32 {
                    spaces += 1
                } else if unit == 9 {
                    tabs += 1
                } else {
                    blank = false
                    break
                }
            }
            if blank {
                continue
            }
            if tabs > 0 {
                if line.utf16.first == 9 && spaces == 0 {
                    tabLines += 1
                }
                previous = nil
                continue
            }
            if spaces > 0 {
                spaceLines += 1
            }
            if let previous {
                let step = spaces - previous
                if step >= 2 && step <= maxIndentSize {
                    steps[step, default: 0] += 1
                }
            }
            previous = spaces
        }
        if tabLines == 0 && spaceLines == 0 {
            return nil
        }
        if tabLines > spaceLines {
            return Indent(useTabs: true, size: nil)
        }
        var size: Int?
        var best = 0
        for (step, count) in steps.sorted(by: { $0.key < $1.key }) where count > best {
            size = step
            best = count
        }
        return size.map { Indent(useTabs: false, size: $0) }
    }

    /// The status bar's indentation item: "Spaces: 2", or "Tab Size: 4" for a file indented with tabs.
    public static func indentLabel(_ indent: Indent?) -> String {
        if let indent, indent.useTabs {
            return "Tab Size: \(defaultTabSize)"
        }
        return "Spaces: \(indent?.size ?? defaultTabSize)"
    }
}
