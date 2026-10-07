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
        .systemLibrary(name: "GMBridge", path: "App/Bridge"),
        .executableTarget(
            name: "GitManagerNative",
            dependencies: ["GMBridge"],
            path: "App/Sources",
            linkerSettings: [.unsafeFlags(["-L", bridgeLibrary])]
        ),
        .target(name: "MeasureKit", path: "Tools/MeasureKit"),
        .executableTarget(name: "GMMeasure", dependencies: ["MeasureKit"], path: "Tools/Measure"),
        .testTarget(name: "MeasureKitTests", dependencies: ["MeasureKit"], path: "Tools/Tests"),
    ],
    // Swift 6 tools for Swift Testing (the Command Line Tools have no XCTest); the code stays in Swift 5 mode.
    swiftLanguageModes: [.v5]
)
