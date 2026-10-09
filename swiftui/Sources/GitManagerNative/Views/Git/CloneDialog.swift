// Clone Repository (CloneDialog.svelte in GitDialogFrame.svelte): a dialog 580 wide (at most the window less 32) at
// 10% of the height from the top, over the window dimmed by --overlay, its shadow in the overlay (DialogBackdrop).
// 18 by 20 points of padding (16 at the bottom), the 14-point semibold title 12 above the fields, which are 10 apart:
// each a 12-point --text-dim label 5 above a 28-point input. The URL is in the code font and takes the keyboard; the
// parent folder has Browse... beside it. Under the fields the clone's path, its progress or what went wrong; 16
// points lower Cancel and Clone at the right, 8 apart.

import NativeCore
import SwiftUI

struct CloneDialog: View {
    @EnvironmentObject private var center: CloneCenter
    @State private var focused = "url"

    var body: some View {
        GitDialogFrame(title: "Clone Repository", width: 580, closable: !center.cloning, onCancel: center.close,
                       onSubmit: center.submit) {
            field("Repository URL") {
                input($center.url, name: "url", mono: true,
                      placeholder: "https://github.com/owner/repo.git or git@github.com:owner/repo.git")
            }
            if let error = CloneRules.urlError(center.url), !center.url.isEmpty {
                note(error, color: "--danger")
            }
            field("Clone into folder") {
                HStack(spacing: 8) {
                    input($center.parentDir, name: "parent")
                    DialogButton(title: "Browse...", disabled: center.cloning, hug: true, action: center.browse)
                }
            }
            field("Folder name") {
                input(Binding(get: { center.folderName }, set: { value in
                    center.folderName = value
                    center.folderEdited = !value.trimmingCharacters(in: .whitespaces).isEmpty
                }), name: "folder")
            }
            if let error = CloneRules.folderNameError(center.folderName), !center.folderName.isEmpty {
                note(error, color: "--danger")
            } else if !center.targetPath.isEmpty {
                note(center.targetPath, color: "--text-faint")
            }
            if center.cloning {
                GitDialogProgress(line: center.progressLine)
            }
            if let notice = center.cloneNotice {
                note(notice, color: "--text-faint")
            }
            if let error = center.cloneError {
                note(error, color: "--danger")
            }
        } footer: {
            if center.cloning {
                DialogButton(title: center.cancelling ? "Cancelling..." : "Cancel", disabled: center.cancelling,
                             hug: true, action: center.cancel)
            } else {
                DialogButton(title: "Cancel", hug: true, action: center.close)
            }
            DialogButton(title: center.cloning ? "Cloning..." : "Clone", primary: true,
                         disabled: !center.canClone, hug: true, action: center.submit)
        }
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        GitDialogField(label: label, content: content)
    }

    private func note(_ text: String, color: String) -> some View {
        GitDialogText(text: text, token: color)
    }

    private func input(_ text: Binding<String>, name: String, mono: Bool = false, placeholder: String = "")
        -> some View {
        PageInput(text: text, focused: focused == name, mono: mono, placeholder: placeholder,
                  autofocus: name == "url", onFocus: { focused = name })
            .disabled(center.cloning)
    }
}
