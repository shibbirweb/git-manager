// The GitHub account features' rules (src/lib/views/github/githubModel.ts): validation, defaults and labels for
// Share Project, Sync Fork, Create Gist and the sign-in form. The API calls happen in Rust.

import Foundation

public enum GitHubModel {
    /// Creates a classic token with the scopes Share Project and Create Gist need.
    public static let tokenURL = "https://github.com/settings/tokens/new?scopes=repo,gist&description=Git%20Manager"

    static let nameLimit = 100

    /// GitHub's repository name rules; nil when the name is fine.
    public static func validateRepositoryName(_ repositoryName: String) -> String? {
        let name = repositoryName.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty {
            return "Enter a repository name"
        }
        if name.utf16.count > nameLimit {
            return "A repository name has at most 100 characters"
        }
        if name == "." || name == ".." {
            return "This repository name is reserved"
        }
        if name.lowercased().hasSuffix(".git") {
            return "Leave out the .git ending"
        }
        if !name.unicodeScalars.allSatisfy(isNameCharacter) {
            return "Use only letters, digits, '.', '-' and '_'"
        }
        return nil
    }

    /// The folder name as GitHub would accept it: other characters become '-'.
    public static func suggestRepositoryName(_ folderName: String) -> String {
        var name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.lowercased().hasSuffix(".git") {
            name.removeLast(4)
        }
        var cleaned = ""
        var inRun = false
        for scalar in name.unicodeScalars {
            if isNameCharacter(scalar) {
                cleaned.unicodeScalars.append(scalar)
                inRun = false
            } else if !inRun {
                cleaned.append("-")
                inRun = true
            }
        }
        while cleaned.hasPrefix("-") {
            cleaned.removeFirst()
        }
        while cleaned.hasSuffix("-") {
            cleaned.removeLast()
        }
        cleaned = String(cleaned.prefix(nameLimit))
        return cleaned == "." || cleaned == ".." ? "" : cleaned
    }

    /// "origin", or "github" when origin is taken, then "github-2"...
    public static func defaultShareRemoteName(_ remoteNames: [String]) -> String {
        if !remoteNames.contains("origin") {
            return "origin"
        }
        if !remoteNames.contains("github") {
            return "github"
        }
        var suffix = 2
        while remoteNames.contains("github-\(suffix)") {
            suffix += 1
        }
        return "github-\(suffix)"
    }

    public static func validateShareRemoteName(_ remoteName: String, _ remoteNames: [String]) -> String? {
        let name = remoteName.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty {
            return "Enter a remote name"
        }
        let forbidden = CharacterSet.whitespaces.union(CharacterSet(charactersIn: "~^:?*[\\"))
        if name.hasPrefix("-") || name.unicodeScalars.contains(where: forbidden.contains) || name.contains("..") {
            return "Not a valid remote name"
        }
        if remoteNames.contains(name) {
            return "A remote named \(name) already exists"
        }
        return nil
    }

    public static func validateGistFileName(_ fileName: String) -> String? {
        let name = fileName.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty {
            return "Enter a file name"
        }
        if name.contains("/") || name.contains("\\") {
            return "A gist file name cannot contain slashes"
        }
        return nil
    }

    /// The last segment of a path, for the gist's file name.
    public static func gistFileName(_ filePath: String?) -> String {
        (filePath ?? "").split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? ""
    }

    /// The fork's branch to sync: the current branch when it tracks the same name on the fork's remote, else the
    /// default branch.
    public static func syncForkBranch(branch: String?, upstream: String?, remoteName: String,
                                      defaultBranch: String?) -> String? {
        if let branch, upstream == "\(remoteName)/\(branch)" {
            return branch
        }
        return defaultBranch ?? branch
    }

    /// The title of a Sync Fork outcome ("fastForward", "merge", "upToDate", "conflict").
    public static func syncForkTitle(_ kind: String) -> String {
        switch kind {
        case "fastForward":
            return "Fork synced (fast-forward)"
        case "merge":
            return "Fork synced (merge commit)"
        case "upToDate":
            return "Fork is up to date"
        default:
            return "Fork has conflicts"
        }
    }

    /// The compare page that opens a pull request from the upstream branch into the fork's branch, for when GitHub
    /// cannot sync because of conflicts.
    public static func forkCompareURL(fork: (owner: String, repo: String), parent: (owner: String, repo: String),
                                      branchName: String, parentBranch: String? = nil) -> String {
        let base = encodeSegments(branchName)
        let head = "\(encodeComponent(parent.owner)):\(encodeComponent(parent.repo)):"
            + encodeSegments(parentBranch ?? branchName)
        return "https://github.com/\(encodeComponent(fork.owner))/\(encodeComponent(fork.repo))/compare/"
            + "\(base)...\(head)?expand=1"
    }

    /// Up to two letters for the avatar circle: from the name's words, else the login.
    public static func accountInitials(login: String, name: String?) -> String {
        let words = (name ?? "").split(whereSeparator: \.isWhitespace).map(String.init)
        if words.count >= 2, let first = words.first?.first, let last = words.last?.first {
            return String([first, last]).uppercased()
        }
        let source = words.first ?? login
        return String(source.prefix(2)).uppercased()
    }

    public static func missingScopesHint(_ missingScopes: [String]) -> String? {
        guard !missingScopes.isEmpty else {
            return nil
        }
        let list = missingScopes.joined(separator: " and ")
        return "This token lacks the \(list) scope\(missingScopes.count > 1 ? "s" : ""): some GitHub actions will fail."
    }

    private static func isNameCharacter(_ scalar: Unicode.Scalar) -> Bool {
        scalar.isASCII && (CharacterSet.alphanumerics.contains(scalar) || "._-".unicodeScalars.contains(scalar))
    }

    /// encodeURIComponent: everything but letters, digits and -_.!~*'() is percent-encoded.
    private static func encodeComponent(_ text: String) -> String {
        var allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        allowed.insert(charactersIn: "-_.!~*'()")
        return text.addingPercentEncoding(withAllowedCharacters: allowed) ?? text
    }

    private static func encodeSegments(_ text: String) -> String {
        text.split(separator: "/").map { encodeComponent(String($0)) }.joined(separator: "/")
    }
}
