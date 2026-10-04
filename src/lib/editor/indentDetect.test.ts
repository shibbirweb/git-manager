import { describe, expect, it } from "vitest";
import { detectIndentation } from "./indentDetect";

const lines = (text: string) => text.split("\n");

describe("detectIndentation", () => {
  it("finds two and four space files", () => {
    const two = "function a() {\n  if (b) {\n    c();\n  }\n}\n\nclass D {\n  e() {\n    return 1;\n  }\n}";
    expect(detectIndentation(lines(two))).toEqual({ useTabs: false, size: 2 });
    const four = two.replace(/^( +)/gm, (spaces) => spaces + spaces);
    expect(detectIndentation(lines(four))).toEqual({ useTabs: false, size: 4 });
  });

  it("finds tabs", () => {
    expect(detectIndentation(lines("func a() {\n\tif b {\n\t\tc()\n\t}\n}"))).toEqual({ useTabs: true, size: null });
  });

  it("goes with what most lines do", () => {
    const mostlyTabs = "a {\n\tb\n\tc\n\td\n  e\n}";
    expect(detectIndentation(lines(mostlyTabs))?.useTabs).toBe(true);
    const mostlySpaces = "a {\n  b\n  c\n\td\n}";
    expect(detectIndentation(lines(mostlySpaces))).toEqual({ useTabs: false, size: 2 });
  });

  it("counts only steps into a deeper level, so closing several levels at once does not count", () => {
    const deep = "a:\n  b:\n    c:\n      d: 1\ne: 2\nf:\n  g: 3";
    expect(detectIndentation(lines(deep))).toEqual({ useTabs: false, size: 2 });
  });

  it("skips blank lines, comment stars and wide alignment", () => {
    const text = [
      "class A {",
      "    /**",
      "     * Doc.",
      "     */",
      "",
      "      ",
      "    run(first,",
      "                second) {",
      "        go();",
      "    }",
      "}",
    ];
    expect(detectIndentation(text)).toEqual({ useTabs: false, size: 4 });
  });

  it("gives up when the file has nothing to follow", () => {
    expect(detectIndentation([])).toBeNull();
    expect(detectIndentation(lines("a\nb\n\nc"))).toBeNull();
    // One space steps only: comment alignment, not an indent size.
    expect(detectIndentation(lines("/*\n * a\n */"))).toBeNull();
  });

  it("breaks a tie toward the smaller step and reads only the first lines", () => {
    expect(detectIndentation(lines("a\n  b\nc\n    d"))).toEqual({ useTabs: false, size: 2 });
    const text = ["a", "  b", ...Array.from({ length: 20 }, (_, index) => (index % 2 ? "    x" : "y"))];
    expect(detectIndentation(text, 2)).toEqual({ useTabs: false, size: 2 });
    expect(detectIndentation(text)).toEqual({ useTabs: false, size: 4 });
  });
});
