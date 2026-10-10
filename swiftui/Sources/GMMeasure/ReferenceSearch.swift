// The layout snapshots of the search popups (gm-measure reference --screens quickopen,palette,search): only the
// popup, as the window behind it is the Changes screen the slice-1 snapshots already hold.

import Foundation

extension Reference {
    static let searchScreens = Measure.searchScreens.map { name in
        Screen(name: name, parts: [
            Part(name: "popup", selector: ".popup, .popup *", limit: 100),
        ])
    }
}
