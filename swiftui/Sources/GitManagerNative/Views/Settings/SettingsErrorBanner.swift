// The banner the Settings dialog shows when settings.json could not be read (.error-banner): defaults are in use and
// the file is left alone until it reads again.

import SwiftUI

struct SettingsErrorBanner: View {
    @Environment(\.theme) private var theme

    let message: String
    let retry: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(name: "alert", size: 15)
                .foregroundStyle(theme.ink("--danger"))
            VStack(alignment: .leading, spacing: 2) {
                (Text("settings.json could not be read").bold()
                    + Text(", so defaults are in use and it will not be overwritten."))
                    .font(.system(size: 12))
                Text(message)
                    .font(.system(size: 12))
                    .foregroundStyle(theme.ink("--text-dim"))
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
            Button("Try Again", action: retry)
                .controlSize(.small)
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 6, style: .circular)
            .fill(theme.over("--danger", 0.1, on: "--panel")))
        .padding(.horizontal, 22)
        .padding(.bottom, 8)
    }
}
