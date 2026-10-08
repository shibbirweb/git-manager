// Text that takes exactly its advance width, as WebKit lays text out (in 1/64 of a point). SwiftUI rounds a text's
// frame up to the pixel, so every item after a label lands half a point to a point further along than on the page.

import AppKit
import SwiftUI

struct ExactText: View {
    let text: String
    var size: CGFloat = 12
    var weight: NSFont.Weight = .regular

    var body: some View {
        let font = NSFont.systemFont(ofSize: size, weight: weight)
        let width = (text as NSString).size(withAttributes: [.font: font]).width
        Text(text)
            .font(Font(font))
            .lineLimit(1)
            .fixedSize()
            .frame(width: (width * 64).rounded() / 64, alignment: .leading)
    }
}
