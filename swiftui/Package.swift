// swift-tools-version: 6.0
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
    products: [
        .executable(name: "GitManagerNative", targets: ["GitManagerNative"]),
        // Drives and measures both apps from the outside: swift run gm-measure <measure|diff|smoke>.
        .executable(name: "gm-measure", targets: ["GMMeasure"]),
    ],
    targets: [
        // Standard layout: each target in Sources/<name>, each test target in Tests/<name>.
        .systemLibrary(name: "GMBridge"),
        // Pure logic of the native app (diff layout...), kept apart so it can be tested.
        .target(name: "NativeCore"),
        .testTarget(name: "NativeCoreTests", dependencies: ["NativeCore"], exclude: ["Fixtures"]),
        .executableTarget(
            name: "GitManagerNative",
            dependencies: ["GMBridge", "NativeCore"],
            linkerSettings: [.unsafeFlags(["-L", bridgeLibrary])]
        ),
        .target(name: "MeasureKit"),
        .executableTarget(name: "GMMeasure", dependencies: ["MeasureKit"]),
        .testTarget(name: "MeasureKitTests", dependencies: ["MeasureKit"]),
    ],
    // Swift 6 tools for Swift Testing (the Command Line Tools have no XCTest); the code stays in Swift 5 mode.
    swiftLanguageModes: [.v5]
)
