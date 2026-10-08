// swift test (Swift Testing; the Command Line Tools have it, XCTest needs Xcode).

import Foundation
import MeasureKit
import Testing

private func solid(_ width: Int, _ height: Int, _ rgba: [UInt8]) -> RGBAImage {
    RGBAImage(width: width, height: height, pixels: Array([[UInt8]](repeating: rgba, count: width * height).joined()))
}

private func setPixel(_ image: inout RGBAImage, x: Int, y: Int, _ rgba: [UInt8]) {
    let at = (y * image.width + x) * 4
    image.pixels.replaceSubrange(at..<(at + 4), with: rgba)
}

@Test func pngReadsBackWhatItWrites() throws {
    var image = solid(3, 2, [10, 20, 30, 255])
    setPixel(&image, x: 1, y: 1, [200, 100, 50, 255])
    let decoded = try RGBAImage.decode(pngData: try image.pngData())
    #expect(decoded == image)
}

@Test func notAnImageIsRefused() {
    #expect(throws: ToolError.self) {
        try RGBAImage.decode(pngData: Data([1, 2, 3, 4, 5, 6, 7, 8]))
    }
}

@Test func identicalImagesAreIdentical() {
    let result = diffImages(solid(4, 4, [1, 2, 3, 255]), solid(4, 4, [1, 2, 3, 255]))
    #expect(result.identicalPercent == 100)
    #expect(result.box == nil)
    #expect(result.sizeMismatch == nil)
}

@Test func differencesAreBoxedAndToleranceCounts() {
    let first = solid(4, 4, [100, 100, 100, 255])
    var second = first
    setPixel(&second, x: 2, y: 1, [103, 100, 100, 255])
    setPixel(&second, x: 0, y: 3, [100, 160, 100, 255])
    let exact = diffImages(first, second)
    #expect(exact.differentPixels == 2)
    #expect(exact.box == PixelBox(x: 0, y: 1, width: 3, height: 3))
    #expect(exact.maxChannelDelta == 60)
    let loose = diffImages(first, second, tolerance: 3)
    #expect(loose.differentPixels == 1)
    #expect(loose.identicalPercent == 93.75)
}

@Test func rowsAboveFromRowAreLeftOut() {
    let first = solid(4, 4, [100, 100, 100, 255])
    var second = first
    setPixel(&second, x: 1, y: 0, [0, 0, 0, 255])
    setPixel(&second, x: 3, y: 2, [100, 104, 100, 255])
    let result = diffImages(first, second, fromRow: 1)
    #expect(result.comparedPixels == 12)
    #expect(result.differentPixels == 1)
    #expect(result.maxChannelDelta == 4)
    #expect(result.box == PixelBox(x: 3, y: 2, width: 1, height: 1))
}

@Test func onlyTheOverlapIsComparedWhenSizesDiffer() {
    let result = diffImages(solid(4, 4, [0, 0, 0, 255]), solid(2, 3, [0, 0, 0, 255]))
    #expect(result.sizeMismatch == "4x4 vs 2x3")
    #expect(result.comparedPixels == 6)
    #expect(result.identicalPixels == 6)
}

@Test func freePortIsUsable() throws {
    let port = try AppLauncher.freePort()
    #expect(port > 1024)
}
