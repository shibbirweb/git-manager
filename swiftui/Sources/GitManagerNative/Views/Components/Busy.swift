// The busy state of a running write (the current app's .busy with its .spinner, in Header.svelte and
// StatusBar.svelte): a turning ring and "Stage...".

import SwiftUI

/// A ring with a 2-point --border-strong line whose top quarter is --accent, turning once every 0.8 seconds. The
/// CSS border of a round box joins its sides on the diagonals, so the colored part spans 45 degrees each way.
struct Spinner: View {
    @Environment(\.theme) private var theme
    @State private var turned = false

    let size: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .inset(by: 1)
                .stroke(theme.color("--border-strong"), lineWidth: 2)
            // Trim runs clockwise from 3 o'clock, so the top quarter is 0.625 to 0.875.
            Circle()
                .inset(by: 1)
                .trim(from: 0.625, to: 0.875)
                .stroke(theme.color("--accent"), lineWidth: 2)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(turned ? 360 : 0))
        .animation(.linear(duration: 0.8).repeatForever(autoreverses: false), value: turned)
        .onAppear {
            turned = true
        }
    }
}

/// The spinner and "<label>..." in 12-point --text-dim; `gap` is 6 in the header and 5 in the status bar.
struct BusyLabel: View {
    @Environment(\.theme) private var theme

    let label: String
    let spinnerSize: CGFloat
    let gap: CGFloat

    var body: some View {
        HStack(spacing: gap) {
            Spinner(size: spinnerSize)
            Text("\(label)...")
                .font(.system(size: 12))
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .foregroundStyle(theme.ink("--text-dim"))
    }
}
