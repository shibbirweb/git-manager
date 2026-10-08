// SVG path data ("M12 5v14", "a2 2 0 0 1 2 2") as a CGPath, for the current app's icons (Generated/Icons*.swift).
// Covers every command: M L H V C S Q T A Z, absolute and relative, with repeated arguments. Arcs become cubic
// curves (the SVG spec's endpoint-to-center conversion), as browsers draw them.

import CoreGraphics
import Foundation

enum SVGPath {
    static func parse(_ data: String) -> CGPath {
        var reader = Reader(Array(data.utf8))
        let path = CGMutablePath()
        var current = CGPoint.zero
        var start = CGPoint.zero
        var lastControl: CGPoint?
        var command: UInt8 = 0
        while let next = reader.nextCommand(after: command) {
            command = next
            let relative = command >= 97
            let base = relative ? current : .zero
            func point() -> CGPoint? {
                guard let x = reader.number(), let y = reader.number() else {
                    return nil
                }
                return CGPoint(x: base.x + x, y: base.y + y)
            }
            var control: CGPoint?
            switch command | 0x20 {
            case UInt8(ascii: "m"):
                guard let target = point() else {
                    return path
                }
                path.move(to: target)
                current = target
                start = target
                // Pairs after a moveto are linetos.
                command = relative ? UInt8(ascii: "l") : UInt8(ascii: "L")
            case UInt8(ascii: "l"):
                guard let target = point() else {
                    return path
                }
                path.addLine(to: target)
                current = target
            case UInt8(ascii: "h"):
                guard let x = reader.number() else {
                    return path
                }
                current = CGPoint(x: (relative ? current.x : 0) + x, y: current.y)
                path.addLine(to: current)
            case UInt8(ascii: "v"):
                guard let y = reader.number() else {
                    return path
                }
                current = CGPoint(x: current.x, y: (relative ? current.y : 0) + y)
                path.addLine(to: current)
            case UInt8(ascii: "c"):
                guard let first = point(), let second = point(), let target = point() else {
                    return path
                }
                path.addCurve(to: target, control1: first, control2: second)
                control = second
                current = target
            case UInt8(ascii: "s"):
                let first = reflected(lastControl, around: current)
                guard let second = point(), let target = point() else {
                    return path
                }
                path.addCurve(to: target, control1: first, control2: second)
                control = second
                current = target
            case UInt8(ascii: "q"):
                guard let quad = point(), let target = point() else {
                    return path
                }
                path.addQuadCurve(to: target, control: quad)
                control = quad
                current = target
            case UInt8(ascii: "t"):
                let quad = reflected(lastControl, around: current)
                guard let target = point() else {
                    return path
                }
                path.addQuadCurve(to: target, control: quad)
                control = quad
                current = target
            case UInt8(ascii: "a"):
                guard let radiusX = reader.number(), let radiusY = reader.number(), let rotation = reader.number(),
                      let large = reader.flag(), let sweep = reader.flag(), let target = point() else {
                    return path
                }
                SVGArc.add(to: path, from: current, to: target, radii: CGSize(width: radiusX, height: radiusY),
                           rotation: rotation, largeArc: large, sweep: sweep)
                current = target
            case UInt8(ascii: "z"):
                path.closeSubpath()
                current = start
            default:
                return path
            }
            lastControl = control
        }
        return path
    }

    /// The previous control point mirrored through the current point (S and T); the current point without one.
    private static func reflected(_ control: CGPoint?, around current: CGPoint) -> CGPoint {
        guard let control else {
            return current
        }
        return CGPoint(x: 2 * current.x - control.x, y: 2 * current.y - control.y)
    }

    /// Reads numbers, flags and command letters from path data.
    private struct Reader {
        private let bytes: [UInt8]
        private var index = 0

        init(_ bytes: [UInt8]) {
            self.bytes = bytes
        }

        /// The next command letter, or the previous one again when more arguments follow (implicit repeat).
        mutating func nextCommand(after previous: UInt8) -> UInt8? {
            skipSeparators()
            guard index < bytes.count else {
                return nil
            }
            let byte = bytes[index]
            if (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122), byte != UInt8(ascii: "e"),
               byte != UInt8(ascii: "E") {
                index += 1
                return byte
            }
            return previous == 0 || previous | 0x20 == UInt8(ascii: "z") ? nil : previous
        }

        mutating func number() -> CGFloat? {
            skipSeparators()
            let begin = index
            if index < bytes.count, bytes[index] == UInt8(ascii: "-") || bytes[index] == UInt8(ascii: "+") {
                index += 1
            }
            var seenDot = false
            var seenExponent = false
            while index < bytes.count {
                let byte = bytes[index]
                if byte >= 48 && byte <= 57 {
                    index += 1
                } else if byte == UInt8(ascii: ".") && !seenDot && !seenExponent {
                    seenDot = true
                    index += 1
                } else if (byte == UInt8(ascii: "e") || byte == UInt8(ascii: "E")) && !seenExponent {
                    seenExponent = true
                    index += 1
                    if index < bytes.count, bytes[index] == UInt8(ascii: "-") || bytes[index] == UInt8(ascii: "+") {
                        index += 1
                    }
                } else {
                    break
                }
            }
            guard index > begin, let text = String(bytes: bytes[begin..<index], encoding: .ascii),
                  let value = Double(text) else {
                index = begin
                return nil
            }
            return CGFloat(value)
        }

        /// An arc flag: a single 0 or 1, which may touch the next number ("0 01 2" is valid).
        mutating func flag() -> Bool? {
            skipSeparators()
            guard index < bytes.count, bytes[index] == UInt8(ascii: "0") || bytes[index] == UInt8(ascii: "1") else {
                return nil
            }
            defer {
                index += 1
            }
            return bytes[index] == UInt8(ascii: "1")
        }

        private mutating func skipSeparators() {
            while index < bytes.count, [32, 9, 10, 13, 44].contains(bytes[index]) {
                index += 1
            }
        }
    }
}
