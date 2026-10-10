// Calls the Rust backend (swiftui/bridge) like the web page's `invoke`: a command name and
// camelCase JSON arguments in, a decoded value out. Calls block, so run them off the main actor.

import Foundation
import GMBridge

struct BackendError: Error, Decodable {
    let kind: String
    let message: String
}

enum Backend {
    private struct Reply<Value: Decodable>: Decodable {
        let ok: Bool
        let value: Value?
        let error: BackendError?
    }

    static func call<Args: Encodable, Value: Decodable>(_ command: String, _ args: Args) throws -> Value {
        guard let value: Value = try reply(command, args) else {
            throw BackendError(kind: "bridge", message: "\(command) returned nothing")
        }
        return value
    }

    /// For commands that answer nothing on success (stage_files, unstage_files).
    static func perform<Args: Encodable>(_ command: String, _ args: Args) throws {
        let _: NoValue? = try reply(command, args)
    }

    private static func reply<Args: Encodable, Value: Decodable>(_ command: String, _ args: Args) throws -> Value? {
        let encoder = JSONEncoder()
        let argsText = String(decoding: try encoder.encode(args), as: UTF8.self)
        guard let raw = gm_call(command, argsText) else {
            throw BackendError(kind: "bridge", message: "No reply from \(command)")
        }
        defer {
            gm_free_string(raw)
        }
        let reply = try JSONDecoder().decode(Reply<Value>.self, from: Data(String(cString: raw).utf8))
        if let error = reply.error {
            throw error
        }
        guard reply.ok else {
            throw BackendError(kind: "bridge", message: "\(command) failed without a reason")
        }
        return reply.value
    }
}
