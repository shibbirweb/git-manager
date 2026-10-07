// swift-tools-version: 5.9
// Git Manager Native: the SwiftUI experiment (docs/plans/swiftui-experiment.md).
// Build the Rust bridge first (scripts/build-app.sh does both).

import Foundation
import PackageDescription

// The static library from bridge/ (cargo build --release), found by absolute path so the
// linker does not depend on the directory swift build runs in.
let bridgeLibrary = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .appendingPathComponent("bridge/target/release")
    .path

let package = Package(
    name: "GitManagerNative",
    platforms: [.macOS(.v13)],
    targets: [
        .systemLibrary(name: "GMBridge", path: "App/Bridge"),
        .executableTarget(
            name: "GitManagerNative",
            dependencies: ["GMBridge"],
            path: "App/Sources",
            linkerSettings: [.unsafeFlags(["-L", bridgeLibrary])]
        ),
    ]
)
