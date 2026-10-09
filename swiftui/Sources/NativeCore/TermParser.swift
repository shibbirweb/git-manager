// The escape sequence parser: UTF-8 bytes in, printable characters, controls and sequences out. The states follow
// the VT500 parser that xterm.js implements (EscapeSequenceParser.ts): ground, escape, CSI, OSC, and DCS and
// SOS/PM/APC strings, which are read to their end and ignored.

public struct TermCSI: Equatable, Sendable {
    /// Parameters, 0 where one was left out; sub parameters (after ':') in `subParams` by parameter index.
    public var params: [Int] = []
    public var subParams: [Int: [Int]] = [:]
    /// '?', '>', '=' or '<' before the parameters, else nil.
    public var prefix: Character?
    public var intermediates = ""
    public var final: Character = "@"

    public init() {}

    public func param(_ index: Int, default fallback: Int = 0) -> Int {
        index < params.count ? params[index] : fallback
    }

    /// The parameter, with 0 or a missing one read as `fallback` (most cursor moves count 0 as 1).
    public func count(_ index: Int, default fallback: Int = 1) -> Int {
        let value = param(index)
        return value == 0 ? fallback : value
    }
}

public protocol TermParserHandler: AnyObject {
    func print(_ scalar: Unicode.Scalar)
    func execute(_ control: UInt8)
    func escape(intermediates: String, final: Character)
    func csi(_ sequence: TermCSI)
    func osc(_ identifier: Int, _ data: String)
}

public struct TermParser {
    enum State {
        case ground, escape, escapeIntermediate, csiEntry, csiParam, csiIntermediate, csiIgnore
        case osc, oscEscape, string, stringEscape
    }

    private var state = State.ground
    private var csi = TermCSI()
    private var current: Int?
    private var subIndex: Int?
    private var oscText: [UInt8] = []
    private var escIntermediates = ""
    private var utf8 = UTF8Decoder()
    private var decoded: [Unicode.Scalar] = []

    static let maxParams = 32
    static let maxOscBytes = 1 << 16

    public init() {}

    public mutating func feed(_ bytes: UnsafeBufferPointer<UInt8>, to handler: TermParserHandler) {
        for byte in bytes {
            if state == .osc || state == .oscEscape {
                oscByte(byte, handler)
                continue
            }
            if byte < 0x80 && utf8.isIdle {
                step(Unicode.Scalar(byte), handler)
                continue
            }
            utf8.push(byte, into: &decoded)
            for scalar in decoded {
                step(scalar, handler)
            }
            decoded.removeAll(keepingCapacity: true)
        }
    }

    public mutating func feed(_ bytes: [UInt8], to handler: TermParserHandler) {
        bytes.withUnsafeBufferPointer { feed($0, to: handler) }
    }

    private mutating func step(_ scalar: Unicode.Scalar, _ handler: TermParserHandler) {
        let value = scalar.value
        // CAN and SUB cancel a sequence; ESC starts one, in every state but a string's body.
        if value == 0x18 || value == 0x1A {
            state = .ground
            return
        }
        if value == 0x1B {
            if state == .string {
                state = .stringEscape
                return
            }
            state = .escape
            escIntermediates = ""
            return
        }
        switch state {
        case .ground:
            if value < 0x20 || value == 0x7F {
                execute(value, handler)
            } else {
                handler.print(scalar)
            }
        case .escape, .escapeIntermediate:
            escapeStep(scalar, handler)
        case .csiEntry, .csiParam, .csiIntermediate, .csiIgnore:
            csiStep(scalar, handler)
        case .string:
            // DCS, SOS, PM and APC bodies end with ST (ESC \) or BEL; their content is not used.
            if value == 0x07 {
                state = .ground
            }
        case .stringEscape:
            state = value == 0x5C ? .ground : .string
        case .osc, .oscEscape:
            break
        }
    }

    private func execute(_ value: UInt32, _ handler: TermParserHandler) {
        if value != 0x7F {
            handler.execute(UInt8(value))
        }
    }

    private mutating func escapeStep(_ scalar: Unicode.Scalar, _ handler: TermParserHandler) {
        let value = scalar.value
        if value < 0x20 {
            execute(value, handler)
            return
        }
        if value <= 0x2F {
            escIntermediates.unicodeScalars.append(scalar)
            state = .escapeIntermediate
            return
        }
        if state == .escape {
            switch value {
            case 0x5B:
                csi = TermCSI()
                current = nil
                subIndex = nil
                state = .csiEntry
                return
            case 0x5D:
                oscText.removeAll(keepingCapacity: true)
                state = .osc
                return
            case 0x50, 0x58, 0x5E, 0x5F:
                state = .string
                return
            default:
                break
            }
        }
        state = .ground
        handler.escape(intermediates: escIntermediates, final: Character(scalar))
    }

    private mutating func csiStep(_ scalar: Unicode.Scalar, _ handler: TermParserHandler) {
        let value = scalar.value
        if value < 0x20 {
            execute(value, handler)
            return
        }
        if state == .csiIgnore {
            if value >= 0x40 && value <= 0x7E {
                state = .ground
            }
            return
        }
        switch value {
        case 0x30...0x39:
            guard state != .csiIntermediate else {
                state = .csiIgnore
                return
            }
            current = min((current ?? 0) * 10 + Int(value - 0x30), 0x7FFF_FFFF)
            state = .csiParam
        case 0x3A, 0x3B:
            guard state != .csiIntermediate else {
                state = .csiIgnore
                return
            }
            endParam()
            // After ':' the next value is a sub parameter of the last parameter.
            subIndex = value == 0x3A ? max(0, csi.params.count - 1) : nil
            state = .csiParam
        case 0x3C...0x3F:
            if state == .csiEntry {
                csi.prefix = Character(scalar)
                state = .csiParam
            } else {
                state = .csiIgnore
            }
        case 0x20...0x2F:
            endParamIfPending()
            csi.intermediates.unicodeScalars.append(scalar)
            state = .csiIntermediate
        case 0x40...0x7E:
            endParamIfPending()
            csi.final = Character(scalar)
            state = .ground
            handler.csi(csi)
        default:
            break
        }
    }

    private mutating func endParam() {
        let value = current ?? 0
        current = nil
        if let subIndex, subIndex < csi.params.count {
            csi.subParams[subIndex, default: []].append(value)
        } else if csi.params.count < Self.maxParams {
            csi.params.append(value)
        }
    }

    private mutating func endParamIfPending() {
        if current != nil || state == .csiParam {
            endParam()
        }
    }

    private mutating func oscByte(_ byte: UInt8, _ handler: TermParserHandler) {
        if state == .oscEscape {
            state = .ground
            finishOsc(handler)
            if byte != 0x5C {
                // Not ST: the escape starts a new sequence.
                step(Unicode.Scalar(0x1B), handler)
                step(Unicode.Scalar(byte), handler)
            }
            return
        }
        switch byte {
        case 0x07:
            state = .ground
            finishOsc(handler)
        case 0x1B:
            state = .oscEscape
        case 0x18, 0x1A:
            state = .ground
        default:
            if oscText.count < Self.maxOscBytes {
                oscText.append(byte)
            }
        }
    }

    private mutating func finishOsc(_ handler: TermParserHandler) {
        let text = String(decoding: oscText, as: UTF8.self)
        oscText.removeAll(keepingCapacity: true)
        let parts = text.split(separator: ";", maxSplits: 1, omittingEmptySubsequences: false)
        guard let first = parts.first, let identifier = Int(first) else {
            return
        }
        handler.osc(identifier, parts.count > 1 ? String(parts[1]) : "")
    }
}
