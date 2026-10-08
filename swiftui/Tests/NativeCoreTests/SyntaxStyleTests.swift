// The syntax classes as src/app.css colors them.

import NativeCore
import Testing

@Test func syntaxRulesFollowAppCss() {
    #expect(SyntaxStyle.resolve("tok-keyword").colorToken == "--tok-keyword")
    #expect(SyntaxStyle.resolve("tok-variableName").colorToken == nil)
    #expect(SyntaxStyle.resolve("tok-variableName tok-definition").colorToken == "--tok-function")
    #expect(SyntaxStyle.resolve("tok-propertyName tok-definition").colorToken == "--tok-property")
    // tok-tagName comes after tok-typeName in app.css, so it wins.
    #expect(SyntaxStyle.resolve("tok-typeName tok-tagName").colorToken == "--tok-tag")
    #expect(SyntaxStyle.resolve("tok-comment") == SyntaxStyle(colorToken: "--tok-comment", italic: true))
    #expect(SyntaxStyle.resolve("tok-heading").bold)
}

@Test func spansAreClippedToEachLine() {
    let spans = SyntaxSpans(flat: [0, 6, "tok-keyword", 7, 9, "tok-variableName", 10, 20, "tok-string"])
    // The plain variable name has no style, so it is dropped.
    #expect(spans.spans.count == 2)
    let line = spans.line(start: 12, length: 5)
    #expect(line.count == 1)
    #expect(line.first?.from == 0)
    #expect(line.first?.to == 5)
}
