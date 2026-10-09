// The Clone dialog's rules (src/lib/views/git/gitOptions.ts): the folder git clone makes for a URL, and what makes a
// URL or a folder name unusable.

import Foundation

public enum CloneRules {
    /// The folder `git clone` would create for `url`: its last part without ".git" or ".bundle".
    public static func folderName(_ url: String) -> String {
        var text = url.trimmingCharacters(in: .whitespacesAndNewlines)
        text = text.replacingOccurrences(of: #"[/\\]+$"#, with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: #"[/\\]\.git$"#, with: "", options: [.regularExpression, .caseInsensitive])
        text = text.replacingOccurrences(of: #"[/\\]+$"#, with: "", options: .regularExpression)
        let last = text.split(omittingEmptySubsequences: false, whereSeparator: { "/\\:".contains($0) }).last
        return String(last ?? "").replacingOccurrences(of: #"\.(git|bundle)$"#, with: "",
                                                       options: [.regularExpression, .caseInsensitive])
    }

    /// Why a URL cannot be cloned, or nil.
    public static func urlError(_ url: String) -> String? {
        let text = url.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty {
            return "Enter a URL"
        }
        return text.hasPrefix("-") ? "Not a valid URL" : nil
    }

    /// Why a folder name cannot be used, or nil: it must be one name, not "." or "..".
    public static func folderNameError(_ folderName: String) -> String? {
        let name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty {
            return "Enter a folder name"
        }
        if name == "." || name == ".." || name.contains(where: { "/\\\0".contains($0) }) {
            return "Not a valid folder name"
        }
        return nil
    }
}
