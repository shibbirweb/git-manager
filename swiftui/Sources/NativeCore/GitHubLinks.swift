// The project's GitHub pages the welcome screen links to (src/lib/update/releases.ts): the repository, a bug report
// and a feature request, with their query strings encoded as URLSearchParams encodes them.

public enum GitHubLinks {
    public static let repository = "https://github.com/shibbirweb/git-manager"

    public static func bugReport(version: String?, platform: String) -> String {
        var params = [("template", "bug_report.yml"), ("labels", "bug")]
        if let version, !version.isEmpty {
            params.append(("version", version))
        }
        params.append(("platform", platform))
        return "\(repository)/issues/new?\(query(params))"
    }

    public static func featureRequest() -> String {
        "\(repository)/issues/new?\(query([("template", "feature_request.yml"), ("labels", "enhancement")]))"
    }

    /// application/x-www-form-urlencoded: letters, digits and *-._ stay, a space becomes +, the rest %XX.
    static func query(_ params: [(String, String)]) -> String {
        params.map { "\(encode($0.0))=\(encode($0.1))" }.joined(separator: "&")
    }

    static func encode(_ text: String) -> String {
        var result = ""
        for byte in text.utf8 {
            switch byte {
            case UInt8(ascii: "a")...UInt8(ascii: "z"), UInt8(ascii: "A")...UInt8(ascii: "Z"),
                 UInt8(ascii: "0")...UInt8(ascii: "9"), UInt8(ascii: "*"), UInt8(ascii: "-"), UInt8(ascii: "."),
                 UInt8(ascii: "_"):
                result.append(Character(UnicodeScalar(byte)))
            case UInt8(ascii: " "):
                result.append("+")
            default:
                result += "%" + String(byte, radix: 16, uppercase: true).leftPadded(to: 2)
            }
        }
        return result
    }
}

private extension String {
    func leftPadded(to length: Int) -> String {
        count >= length ? self : String(repeating: "0", count: length - count) + self
    }
}
