// Screenshots as plain RGBA bytes, read and written with ImageIO.

import CoreGraphics
import Foundation
import ImageIO

public struct ToolError: Error, CustomStringConvertible {
    public let description: String

    public init(_ description: String) {
        self.description = description
    }
}

public struct RGBAImage: Equatable {
    public let width: Int
    public let height: Int
    /// width * height * 4 bytes, RGBA.
    public var pixels: [UInt8]

    public init(width: Int, height: Int, pixels: [UInt8]) {
        self.width = width
        self.height = height
        self.pixels = pixels
    }

    public static func load(path filePath: String) throws -> RGBAImage {
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: filePath) as CFURL, nil) else {
            throw ToolError("Could not read \(filePath)")
        }
        return try decode(source, name: filePath)
    }

    public static func decode(pngData: Data) throws -> RGBAImage {
        guard let source = CGImageSourceCreateWithData(pngData as CFData, nil) else {
            throw ToolError("Not an image")
        }
        return try decode(source, name: "image data")
    }

    private static func decode(_ source: CGImageSource, name: String) throws -> RGBAImage {
        guard let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw ToolError("Could not decode \(name)")
        }
        return try RGBAImage(cgImage: image)
    }

    /// Draws into the image's own color space, so no color conversion changes a pixel.
    public init(cgImage image: CGImage) throws {
        width = image.width
        height = image.height
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let ownSpace = image.colorSpace.flatMap { $0.model == .rgb ? $0 : nil }
        guard let space = ownSpace ?? CGColorSpace(name: CGColorSpace.sRGB) else {
            throw ToolError("No color space")
        }
        let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(
                data: buffer.baseAddress,
                width: image.width,
                height: image.height,
                bitsPerComponent: 8,
                bytesPerRow: image.width * 4,
                space: space,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else {
                return false
            }
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
            return true
        }
        if !drawn {
            throw ToolError("Could not draw the image")
        }
        pixels = bytes
    }

    public func pngData() throws -> Data {
        guard let space = CGColorSpace(name: CGColorSpace.sRGB),
              let provider = CGDataProvider(data: Data(pixels) as CFData),
              let image = CGImage(
                  width: width,
                  height: height,
                  bitsPerComponent: 8,
                  bitsPerPixel: 32,
                  bytesPerRow: width * 4,
                  space: space,
                  bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                  provider: provider,
                  decode: nil,
                  shouldInterpolate: false,
                  intent: .defaultIntent
              ) else {
            throw ToolError("Could not build the image")
        }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, "public.png" as CFString, 1, nil) else {
            throw ToolError("Could not write a PNG")
        }
        CGImageDestinationAddImage(destination, image, nil)
        if !CGImageDestinationFinalize(destination) {
            throw ToolError("Could not write a PNG")
        }
        return output as Data
    }

    public func write(path filePath: String) throws {
        try pngData().write(to: URL(fileURLWithPath: filePath))
    }
}
