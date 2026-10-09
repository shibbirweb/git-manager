// gm-measure --screen workspace: both apps open the docs demo's acme folder, which is not a repository but holds
// storefront (everyday changes) and payments-api (stopped in a merge), so Changes shows a section per repository.
// --screen folders: a workspace of two folders, acme and design-system (a repository itself, so it is active).

import Foundation

extension Measure {
    static let workspaceScreens = ["workspace", "folders"]

    /// The acme folder around the demo's storefront repository.
    static func workspaceFolder(_ demoRepo: String) -> String {
        (demoRepo as NSString).deletingLastPathComponent
    }

    /// The workspace folders after the first that `screen` opens.
    static func extraFolders(_ screen: String, demoRepo: String) -> [String] {
        guard screen == "folders" else {
            return []
        }
        let demoDir = ((demoRepo as NSString).deletingLastPathComponent as NSString).deletingLastPathComponent
        return [(demoDir as NSString).appendingPathComponent("design-system")]
    }
}
