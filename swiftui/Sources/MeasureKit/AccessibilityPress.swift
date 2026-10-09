// Presses a button in a measured app through Accessibility (AXPress), the same way in both apps, without touching
// the user's pointer. Posted mouse events (CGEvent postToPid) never reach AppKit's windows, even with the app in
// front; posted keys do. WebKit runs an AXPress as a click at the element's center, so a menu that opens at the
// pointer opens there. Needs Accessibility permission for the app that runs gm-measure (the terminal).

import ApplicationServices
import Foundation

public enum AccessibilityPress {
    /// True when this process may read and drive other apps' accessibility elements.
    public static var allowed: Bool {
        AXIsProcessTrusted()
    }

    /// Presses the first button of `pid` whose title or description starts with `title`.
    public static func press(pid: Int32, title: String) throws {
        guard allowed else {
            throw ToolError(
                "No Accessibility permission. Allow the app that runs gm-measure (your terminal) in System Settings "
                    + "> Privacy & Security > Accessibility, then restart it."
            )
        }
        let app = AXUIElementCreateApplication(pid)
        // WebKit builds its page's accessibility tree only for a client that asks for it.
        AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
        for attempt in 0..<10 {
            if attempt > 0 {
                Thread.sleep(forTimeInterval: 0.3)
            }
            guard let button = findButton(app, title: title, depth: 0) else {
                continue
            }
            let result = AXUIElementPerformAction(button, kAXPressAction as CFString)
            if result == .success {
                return
            }
            // An app still busy (reading its repositories) cannot answer yet.
            if result != .cannotComplete || attempt == 9 {
                throw ToolError("AXPress on \"\(title)\" failed (\(result.rawValue))")
            }
        }
        throw ToolError("No button titled \"\(title)\" in process \(pid)")
    }

    private static func findButton(_ element: AXUIElement, title: String, depth: Int) -> AXUIElement? {
        if depth > 40 {
            return nil
        }
        let role = attribute(element, kAXRoleAttribute) as? String
        // WebKit names a button by its title, SwiftUI by its description (accessibilityLabel).
        let names = [kAXTitleAttribute, kAXDescriptionAttribute].compactMap { attribute(element, $0) as? String }
        if role == kAXButtonRole as String, names.contains(where: { $0.hasPrefix(title) }) {
            return element
        }
        for child in attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [] {
            if let found = findButton(child, title: title, depth: depth + 1) {
                return found
            }
        }
        return nil
    }

    private static func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
        var value: AnyObject?
        AXUIElementCopyAttributeValue(element, name as CFString, &value)
        return value
    }
}
