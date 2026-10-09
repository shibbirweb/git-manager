// gm-measure --screen workspace: both apps open the docs demo's acme folder, which is not a repository but holds
// storefront (everyday changes) and payments-api (stopped in a merge), so Changes shows a section per repository.

import Foundation

extension Measure {
    static let workspaceScreens = ["workspace"]

    /// The acme folder around the demo's storefront repository.
    static func workspaceFolder(_ demoRepo: String) -> String {
        (demoRepo as NSString).deletingLastPathComponent
    }
}
