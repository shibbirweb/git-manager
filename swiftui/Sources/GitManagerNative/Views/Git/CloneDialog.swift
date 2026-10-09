// Clone Repository (CloneDialog.svelte in GitDialogFrame.svelte): a dialog 580 wide (at most the window less 32) at
// 10% of the height from the top, over the window dimmed by --overlay, its shadow in the overlay (DialogBackdrop).
// 18 by 20 points of padding (16 at the bottom), the 14-point semibold title 12 above the fields, which are 10 apart:
// each a 12-point --text-dim label 5 above a 28-point input. The URL is in the code font and takes the keyboard; the
// parent folder has Browse... beside it. Under the fields the clone's path, its progress or what went wrong; 16
// points lower Cancel and Clone at the right, 8 apart.

import NativeCore
import SwiftUI

struct CloneDialog: View {
    @Environment(\.theme) private var theme
    @EnvironmentObject private var center: CloneCenter
    @State private var dialogFrame: CGRect = .zero
    @State private var focused = "url"

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                DialogBackdrop(dialog: dialogFrame, cornerRadius: 10, overlayAlpha: theme.alpha("--overlay"),
                               shadow: DialogBackdrop.parseShadow(theme.raw("--shadow") ?? ""), shadowInOverlay: true)
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { center.close() }
                dialog
                    .frame(width: min(580, proxy.size.width - 32))
                    .background(GeometryReader { box in
                        let frame = box.frame(in: .named("clone"))
                        Color.clear
                            .onAppear { dialogFrame = frame }
                            .onChange(of: frame) { dialogFrame = $0 }
                    })
                    .padding(.top, proxy.size.height * 0.1)
            }
            .coordinateSpace(name: "clone")
        }
    }

    private var dialog: some View {
        VStack(alignment: .leading, spacing: 0) {
            ExactText(text: "Clone Repository", size: 14, weight: .semibold)
                .foregroundStyle(theme.ink("--text"))
                .padding(.bottom, 12)
            VStack(alignment: .leading, spacing: 10) {
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
                    HStack(spacing: 8) {
                        BusyLabel(label: center.progressLine, spinnerSize: 12, gap: 8)
                    }
                    .font(.system(size: 12))
                    .foregroundStyle(theme.ink("--text-dim"))
                }
                if let notice = center.cloneNotice {
                    note(notice, color: "--text-faint")
                }
                if let error = center.cloneError {
                    note(error, color: "--danger")
                }
            }
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                if center.cloning {
                    DialogButton(title: center.cancelling ? "Cancelling..." : "Cancel", disabled: center.cancelling,
                                 hug: true, action: center.cancel)
                } else {
                    DialogButton(title: "Cancel", hug: true, action: center.close)
                }
                DialogButton(title: center.cloning ? "Cloning..." : "Clone", primary: true,
                             disabled: !center.canClone, hug: true, action: center.submit)
            }
            .padding(.top, 16)
        }
        // The 1-point border is outside the 18 / 20 / 16 points of padding.
        .padding(.top, 19)
        .padding(.horizontal, 21)
        .padding(.bottom, 17)
        .background(RoundedRectangle(cornerRadius: 10, style: .circular).fill(theme.color("--panel")))
        .borderRing(theme.color("--border-strong"), cornerRadius: 10)
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            ExactText(text: label, size: 12)
                .foregroundStyle(theme.ink("--text-dim"))
            content()
        }
    }

    private func note(_ text: String, color: String) -> some View {
        Text(text)
            .font(PageFont.font(12))
            .foregroundStyle(theme.ink(color))
            .fixedSize(horizontal: false, vertical: true)
    }

    private func input(_ text: Binding<String>, name: String, mono: Bool = false, placeholder: String = "")
        -> some View {
        PageInput(text: text, focused: focused == name, mono: mono, placeholder: placeholder,
                  autofocus: name == "url", onFocus: { focused = name })
            .disabled(center.cloning)
    }
}
