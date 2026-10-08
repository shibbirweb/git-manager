import Foundation
import MeasureKit
import Testing

private func parse(_ text: String) throws -> NSDictionary {
    try #require(JSONSerialization.jsonObject(with: Data(text.utf8)) as? NSDictionary)
}

@Test func shortValuesStayOnOneLine() throws {
    let text = try WrappedJSON.string(["b": 2, "a": "x"])
    #expect(text == "{\"a\": \"x\", \"b\": 2}\n")
}

@Test func longObjectsWrapWithinTheWidthAndParseBack() throws {
    let styles = Dictionary(uniqueKeysWithValues: (0..<30).map { ("style-\($0)", "rgb(\($0), \($0), \($0))") })
    let value: [String: Any] = [
        "elements": (0..<5).map { index in
            ["tag": "div", "rect": ["x": index, "y": 2, "width": 300, "height": 24], "styles": styles]
        },
        "name": "file rows",
    ]
    let text = try WrappedJSON.string(value, width: 60)
    let lines = text.split(separator: "\n")
    #expect(lines.allSatisfy { $0.count <= 60 })
    #expect(try parse(text) == value as NSDictionary)
}

@Test func stringsAreNotChangedBySpacing() throws {
    let value = ["text": "a:b,c \"quoted\" \\ end"]
    #expect(try parse(try WrappedJSON.string(value, width: 20)) == value as NSDictionary)
}
