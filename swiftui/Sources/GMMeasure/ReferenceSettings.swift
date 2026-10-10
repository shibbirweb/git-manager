// gm-measure reference: the Settings dialog over the Changes screen, opened on one section through the app's
// open_settings tool. Its parts: the overlay and frame, the section list with the search field, and the open
// section's rows.

import Foundation

extension Reference {
    static func settingsScreen(name: String, section: String) -> Screen {
        let rows = ".dialog .rows"
        return Screen(name: name, parts: [
            Part(name: "dialog", selector: ".overlay, .dialog, .dialog .nav, .dialog .nav *", limit: 60),
            Part(name: "content head", selector: ".dialog .content, .dialog .content-head, .dialog .content-head *"),
            Part(name: "rows", selector: [".dialog .rows", "\(rows) > *", "\(rows) .label", "\(rows) .label *"]
                .joined(separator: ", ")),
            Part(name: "controls", selector: [
                "\(rows) .segmented", "\(rows) .segmented *", "\(rows) input", "\(rows) .range", "\(rows) .range *",
                "\(rows) .picker", "\(rows) .picker .head", "\(rows) .picker .head *", "\(rows) .list",
            ].joined(separator: ", ")),
            Part(name: "theme options", selector: "\(rows) .group-label, \(rows) .option, \(rows) .option *"),
        ], settingsSection: section)
    }
}
