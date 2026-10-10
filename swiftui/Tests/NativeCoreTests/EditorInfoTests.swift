// The status bar's file items: the language name and the detected indentation, as languages.ts and
// indentDetect.ts give them.

import NativeCore
import Testing

@Test func languageNamesFollowTheExtensionOrTheFileName() {
    #expect(EditorInfo.languageName(filePath: "/repo/src/catalog.ts") == "TypeScript")
    #expect(EditorInfo.languageName(filePath: "README.md") == "Markdown")
    #expect(EditorInfo.languageName(filePath: "/repo/Dockerfile.dev") == "Dockerfile")
    #expect(EditorInfo.languageName(filePath: "/repo/Gemfile") == "Ruby")
    #expect(EditorInfo.languageName(filePath: "/repo/.nvmrc") == "Plain Text")
    #expect(EditorInfo.languageName(filePath: "/repo/Makefile") == "Plain Text")
}

@Test func indentationIsTheMostCommonStep() {
    let catalog = ["export interface Product {", "  id: string;", "  name: string;", "}", "", "function f() {",
                   "  if (x) {", "    return 1;", "  }", "}"]
    #expect(EditorInfo.detectIndentation(catalog) == EditorInfo.Indent(useTabs: false, size: 2))
    #expect(EditorInfo.indentLabel(EditorInfo.detectIndentation(catalog)) == "Spaces: 2")
    let tabs = ["fn main() {", "\tlet x = 1;", "\tif x {", "\t\treturn;", "\t}", "}"]
    #expect(EditorInfo.detectIndentation(tabs) == EditorInfo.Indent(useTabs: true, size: nil))
    #expect(EditorInfo.indentLabel(EditorInfo.Indent(useTabs: true, size: nil)) == "Tab Size: 4")
}

@Test func noIndentationFallsBackToTheTabSizeSetting() {
    #expect(EditorInfo.detectIndentation(["a", "b", ""]) == nil)
    #expect(EditorInfo.indentLabel(nil) == "Spaces: 4")
    // One-space steps (comment stars) are alignment, not indentation.
    #expect(EditorInfo.detectIndentation(["/**", " * a", " */"]) == nil)
}
