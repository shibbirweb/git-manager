// The diff toolbar's .path (src/lib/diff/DiffView.svelte): the file name in semibold with 6 points after it, a space
// and the dim folder, right-aligned in the rest of the row. When the folder does not fit, WebKit does not cut the
// name: the ellipsis follows the name's margin ("cart.ts …") and is itself clipped at the end of the row, where
// SwiftUI would cut the letters ("cart.ts…").

import AppKit
import SwiftUI

struct PathLabel: View {
    @Environment(\.theme) private var theme

    let name: String
    let directory: String

    var body: some View {
        let nameWidth = ExactText.width(name, font: PageFont.ui(12, weight: .semibold))
        let tail = directory.isEmpty ? "" : " " + directory
        let full = nameWidth + 6 + ExactText.width(tail, font: .systemFont(ofSize: 12))
        GeometryReader { proxy in
            let room = proxy.size.width
            HStack(spacing: 0) {
                if full <= room || nameWidth + 6 <= room {
                    // At their own widths; the ellipsis runs past the end and is clipped there.
                    HStack(spacing: 0) {
                        ExactText(text: name, size: 12, weight: .semibold)
                        Color.clear.frame(width: 6)
                        if full <= room {
                            ExactText(text: tail, size: 12)
                                .foregroundStyle(theme.ink("--text-dim"))
                        } else {
                            ExactText(text: "\u{2026}", size: 12)
                        }
                    }
                    .fixedSize()
                    .frame(width: room, alignment: full <= room ? .trailing : .leading)
                } else {
                    Text(name)
                        .font(PageFont.font(12, weight: .semibold))
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            .foregroundStyle(theme.ink("--text"))
            .frame(width: room, height: proxy.size.height, alignment: .leading)
            .clipped()
        }
        .frame(maxWidth: .infinity)
    }
}
