// Reads the display's state with public APIs only: NSScreen for the headroom, screen name and color space, IOKit
// for the brightness where a display reports it (Intel Macs and some external displays; Apple silicon's built-in
// display does not, so the reports say "not readable").

import AppKit
import IOKit
import IOKit.graphics

public enum DisplayProbe {
    /// The measuring screen (MeasureScreen: the built-in display), or nil without a window server connection.
    ///
    /// NSScreen takes new EDR values from the window server on a run loop, which gm-measure (a command without one)
    /// never runs, so a long run should read this from a new process each time (gm-measure display --json).
    public static func read() -> DisplayState? {
        guard let screen = MeasureScreen.screen else {
            return nil
        }
        let reference = Double(screen.maximumReferenceExtendedDynamicRangeColorComponentValue)
        return DisplayState(
            headroom: Double(screen.maximumExtendedDynamicRangeColorComponentValue),
            potentialHeadroom: Double(screen.maximumPotentialExtendedDynamicRangeColorComponentValue),
            referenceHeadroom: reference > 0 ? reference : nil,
            screenName: screen.localizedName,
            colorSpaceName: screen.colorSpace?.localizedName,
            brightness: brightness()
        )
    }

    /// The first display connection that reports a brightness, from 0 to 1.
    static func brightness() -> Double? {
        var iterator: io_iterator_t = 0
        let matching = IOServiceMatching("IODisplayConnect")
        guard IOServiceGetMatchingServices(kIOMainPortDefault, matching, &iterator) == KERN_SUCCESS else {
            return nil
        }
        defer { IOObjectRelease(iterator) }
        var found: Double?
        var service = IOIteratorNext(iterator)
        while service != 0 {
            var value: Float = 0
            let status = IODisplayGetFloatParameter(service, 0, kIODisplayBrightnessKey as CFString, &value)
            IOObjectRelease(service)
            if status == KERN_SUCCESS && found == nil {
                found = Double(value)
            }
            service = IOIteratorNext(iterator)
        }
        return found
    }
}
