// Types into a measured app without touching the user's keyboard focus elsewhere: key events posted to the app's
// process (CGEvent postToPid), which both apps take as typed keys (posted mouse events they do not).

import CoreGraphics
import Foundation

public enum KeyPoster {
    /// Types `text` one character at a time, `interval` seconds apart.
    public static func type(pid: Int32, _ text: String, interval: TimeInterval = 0.02) {
        let source = CGEventSource(stateID: .privateState)
        let units = Array(text.utf16)
        for (index, unit) in units.enumerated() {
            var character = unit
            for down in [true, false] {
                guard let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: down) else {
                    continue
                }
                event.keyboardSetUnicodeString(stringLength: 1, unicodeString: &character)
                event.postToPid(pid)
            }
            // None after the last key, so the caller's clock right after is that key's time.
            if index < units.count - 1 {
                Thread.sleep(forTimeInterval: interval)
            }
        }
    }

    /// One key with modifiers, such as 3 (F) with [.maskShift, .maskCommand].
    public static func press(pid: Int32, keyCode: CGKeyCode, flags: CGEventFlags = []) {
        let source = CGEventSource(stateID: .privateState)
        for down in [true, false] {
            guard let event = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: down) else {
                continue
            }
            event.flags = flags
            event.postToPid(pid)
            Thread.sleep(forTimeInterval: 0.03)
        }
    }
}
