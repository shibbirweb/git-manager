import NativeCore
import Testing

@Test func memoryTextFollowsTheStatusBar() {
    let mb: UInt64 = 1024 * 1024
    #expect(ByteText.status(512 * 1024) == "512 KB")
    #expect(ByteText.status(82 * mb + 400 * 1024) == "82.4 MB")
    #expect(ByteText.status(82 * mb) == "82.0 MB")
    #expect(ByteText.status(161 * mb + 600 * 1024) == "162 MB")
    #expect(ByteText.status(1536 * mb) == "1.50 GB")
}
