// One integrated terminal: a shell in a pseudo terminal run by the bridge (the current app's own PTY code), its
// output parsed by the emulator on the main thread and acknowledged like the page does, so a flood of output never
// queues up more than the bridge's flow control allows (about 2 MB).

import AppKit
import Foundation
import GMBridge
import NativeCore

struct TerminalInfo: Decodable {
    struct Shell: Decodable {
        let id: String
        let name: String
        let path: String
    }

    let terminalId: UInt32
    let pid: UInt32?
    let shell: Shell
    let cwd: String
}

@MainActor
final class TerminalSession: ObservableObject {
    let key: Int
    let term: TermEmulator
    @Published private(set) var info: TerminalInfo?
    @Published private(set) var failure: String?
    @Published private(set) var exitCode: Int32?
    @Published private(set) var exited = false
    /// Grows with every change on screen; the canvas redraws when it moves.
    @Published private(set) var version = 0
    /// Bytes received in all, for the control tools and the memory scenario.
    private(set) var receivedBytes = 0
    var onExit: ((TerminalSession) -> Void)?
    private var redrawScheduled = false
    private var pendingInput = ""

    /// The shell's name as the panel shows it ("zsh"), before and after it started.
    var name: String { info?.shell.name ?? "Terminal" }

    init(key: Int, columns: Int, rows: Int) {
        self.key = key
        term = TermEmulator(columns: columns, rows: rows, scrollback: 5000)
        term.reply = { [weak self] bytes in
            self?.write(String(decoding: bytes, as: UTF8.self))
        }
    }

    func start(cwd: String?) {
        let args: [String: Any] = ["cwd": cwd ?? NSNull(), "cols": term.columns, "rows": term.rows]
        guard let data = try? JSONSerialization.data(withJSONObject: args) else {
            return
        }
        let context = Unmanaged.passRetained(OutputSink(session: self)).toOpaque()
        let raw = String(decoding: data, as: UTF8.self).withCString { argsPointer in
            gm_terminal_spawn(argsPointer, { context, _, bytes, length, exitCode, exited in
                guard let context else {
                    return
                }
                let sink = Unmanaged<OutputSink>.fromOpaque(context)
                if exited {
                    sink.takeUnretainedValue().exit(exitCode == Int32.min ? nil : exitCode)
                    sink.release()
                } else if let bytes {
                    sink.takeUnretainedValue().output(Data(bytes: bytes, count: length))
                }
            }, context)
        }
        guard let raw else {
            Unmanaged<OutputSink>.fromOpaque(context).release()
            failure = "The shell did not start"
            return
        }
        defer {
            gm_free_string(raw)
        }
        let answer = (try? JSONSerialization.jsonObject(with: Data(String(cString: raw).utf8))) as? [String: Any]
        guard answer?["ok"] as? Bool == true, let value = answer?["value"],
              let valueData = try? JSONSerialization.data(withJSONObject: value),
              let info = try? JSONDecoder().decode(TerminalInfo.self, from: valueData) else {
            // A failed spawn never calls back, so its context is released here.
            Unmanaged<OutputSink>.fromOpaque(context).release()
            let error = answer?["error"] as? [String: Any]
            failure = error?["message"] as? String ?? "The shell did not start"
            return
        }
        self.info = info
        if !pendingInput.isEmpty {
            write(pendingInput)
            pendingInput = ""
        }
    }

    /// Typed text and key sequences; before the shell is ready they wait.
    func write(_ text: String) {
        guard !exited else {
            return
        }
        guard let terminalId = info?.terminalId else {
            pendingInput += text
            return
        }
        try? Backend.perform("terminal_write", WriteArgs(terminalId: terminalId, data: text))
    }

    func resize(columns: Int, rows: Int) {
        guard columns != term.columns || rows != term.rows else {
            return
        }
        term.resize(columns: columns, rows: rows)
        if let terminalId = info?.terminalId {
            try? Backend.perform("terminal_resize", ResizeArgs(terminalId: terminalId, cols: columns, rows: rows))
        }
        changed()
    }

    func close() {
        if let terminalId = info?.terminalId, !exited {
            try? Backend.perform("terminal_close", CloseArgs(terminalId: terminalId))
        }
    }

    fileprivate func received(_ data: Data) {
        data.withUnsafeBytes { buffer in
            term.feed(buffer.bindMemory(to: UInt8.self))
        }
        receivedBytes += data.count
        if let terminalId = info?.terminalId {
            try? Backend.perform("terminal_ack", AckArgs(terminalId: terminalId, byteCount: data.count))
        }
        changed()
    }

    fileprivate func ended(_ code: Int32?) {
        exited = true
        exitCode = code
        if code != 0 {
            term.feed("\r\n\u{1B}[2m[Process exited with code \(code.map(String.init) ?? "unknown")]\u{1B}[0m")
            changed()
        }
        onExit?(self)
    }

    /// Redraws at most once per run of the main loop, however many reads arrived.
    func changed() {
        guard !redrawScheduled else {
            return
        }
        redrawScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                return
            }
            redrawScheduled = false
            version &+= 1
        }
    }

    private struct WriteArgs: Encodable {
        let terminalId: UInt32
        let data: String
    }

    private struct ResizeArgs: Encodable {
        let terminalId: UInt32
        let cols: Int
        let rows: Int
    }

    private struct AckArgs: Encodable {
        let terminalId: UInt32
        let byteCount: Int
    }

    private struct CloseArgs: Encodable {
        let terminalId: UInt32
    }
}

/// What the bridge's callback holds: it hops to the main thread with each message.
private final class OutputSink: @unchecked Sendable {
    weak var session: TerminalSession?

    init(session: TerminalSession) {
        self.session = session
    }

    func output(_ data: Data) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                self.session?.received(data)
            }
        }
    }

    func exit(_ code: Int32?) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                self.session?.ended(code)
            }
        }
    }
}
