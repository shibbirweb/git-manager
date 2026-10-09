// The control server's Git > GitHub items (the current app's run_menu_command git.github.*):
//   run_menu_command   command: git.github.share, git.github.syncFork or git.github.createGist, as the menu runs it
//   github_dialog      which GitHub dialog shows in the focused window (signIn, share, gist, result or none)

import Foundation

extension Control {
    static func githubAnswer(_ action: String, _ args: [String: Any]) -> String? {
        switch action {
        case "run_menu_command":
            let command = args["command"] as? String ?? ""
            let known = ["git.github.share", "git.github.syncFork", "git.github.createGist"].contains(command)
            guard known else {
                return reply(ok: false, text: "Not in the native app yet: \(command)")
            }
            onMain {
                let github = WindowContext.focused.github
                Task {
                    switch command {
                    case "git.github.share":
                        await github.shareProject()
                    case "git.github.syncFork":
                        await github.syncFork()
                    default:
                        await github.createGist()
                    }
                }
            }
            return reply(ok: true, text: "Ran \(command)")
        case "github_dialog":
            return reply(ok: true, structured: onMain { ["dialog": dialogName(WindowContext.focused.github.dialog)] })
        default:
            return nil
        }
    }

    @MainActor
    private static func dialogName(_ dialog: GitHubDialog?) -> String {
        switch dialog {
        case .signIn:
            return "signIn"
        case .share:
            return "share"
        case .gist:
            return "gist"
        case .result:
            return "result"
        case nil:
            return "none"
        }
    }
}
