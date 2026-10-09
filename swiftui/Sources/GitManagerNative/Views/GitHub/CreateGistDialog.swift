// Create Gist (CreateGistDialog.svelte): the file on screen or its selection as a secret or public gist, with a
// preview of what is uploaded (the first 20,000 characters show; all of it goes up). The end is a result dialog.

import NativeCore
import SwiftUI

private struct GistRequest: Encodable {
    let fileName: String
    let description: String
    let `public`: Bool
    let content: String
}

private struct GistArgs: Encodable {
    let request: GistRequest
}

private struct CreatedGist: Decodable {
    let htmlUrl: String
}

struct CreateGistDialog: View {
    @EnvironmentObject private var center: GitHubCenter

    let content: String
    let fromSelection: Bool

    @State private var fileName: String
    @State private var description = ""
    @State private var visibility = 0
    @State private var working = false
    @State private var problem: String?
    @State private var focused = "file"

    init(fileName: String, content: String, fromSelection: Bool) {
        self.content = content
        self.fromSelection = fromSelection
        _fileName = State(initialValue: fileName)
    }

    private static let previewCharacters = 20_000

    private var isPublic: Bool {
        visibility == 1
    }

    private var fileNameError: String? {
        GitHubModel.validateGistFileName(fileName)
    }

    private var empty: Bool {
        content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var lineCount: Int {
        content.isEmpty ? 0 : content.reduce(1) { $1 == "\n" ? $0 + 1 : $0 }
    }

    private var preview: String {
        content.count > Self.previewCharacters ? String(content.prefix(Self.previewCharacters)) + "\n..." : content
    }

    private var canCreate: Bool {
        !working && fileNameError == nil && !empty
    }

    var body: some View {
        GitDialogFrame(title: "Create Gist", width: 600, closable: !working, onCancel: close, onSubmit: submit) {
            HStack(alignment: .top, spacing: 8) {
                GitDialogField(label: "File name") {
                    input($fileName, name: "file")
                }
                GitDialogField(label: "Visibility") {
                    GitDialogSegments(labels: ["Secret", "Public"], selected: $visibility, disabled: working)
                }
                .fixedSize()
            }
            if let fileNameError {
                GitDialogText(text: fileNameError, token: "--danger")
            }
            GitDialogField(label: "Description") {
                input($description, name: "description", placeholder: "Optional")
            }
            GitDialogField(label: "\(fromSelection ? "Selection" : "Whole file"), \(lineCount) "
                           + (lineCount == 1 ? "line" : "lines")) {
                GistPreview(text: preview)
            }
            if empty {
                GitDialogText(text: "There is nothing to share: the \(fromSelection ? "selection" : "file") is empty.",
                              token: "--danger")
            }
            if let problem {
                GitDialogText(text: problem, token: "--danger", selectable: true)
            }
        } footer: {
            DialogButton(title: "Cancel", disabled: working, hug: true, action: close)
            DialogButton(title: working ? "Creating..." : "Create Gist", primary: true, disabled: !canCreate,
                         hug: true, action: submit)
        }
    }

    private func input(_ text: Binding<String>, name: String, placeholder: String = "") -> some View {
        PageInput(text: text, focused: focused == name, placeholder: placeholder, autofocus: name == "file",
                  onFocus: { focused = name })
            .disabled(working)
    }

    private func close() {
        if !working {
            center.close()
        }
    }

    private func submit() {
        guard canCreate else {
            return
        }
        if isPublic, !GitDialogConfirm.danger(
            title: "Create Public Gist",
            message: "A public gist is listed on your profile and can be found by anyone. Create it as public?",
            button: "Create Public"
        ) {
            return
        }
        let name = fileName.trimmingCharacters(in: .whitespaces)
        let request = GistRequest(fileName: name, description: description.trimmingCharacters(in: .whitespaces),
                                  public: isPublic, content: content)
        let shownPublic = isPublic
        working = true
        problem = nil
        Task {
            let created = await Task.detached {
                Result { try Backend.call("github_create_gist", GistArgs(request: request)) as CreatedGist }
            }.value
            switch created {
            case .success(let gist):
                center.open(.result(
                    title: "Gist Created",
                    message: "\(shownPublic ? "Public" : "Secret") gist with \(name)."
                        + (shownPublic ? "" : " Anyone with the link can see it."),
                    url: gist.htmlUrl, openLabel: "Open Gist", problem: nil
                ))
            case .failure(let error):
                problem = AppModel.describe(error)
                working = false
            }
        }
    }
}
