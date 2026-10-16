import { htmlLanguage } from "@codemirror/lang-html";
import { highlightCode } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import { codeHighlighters } from "./highlighter";

/** Each highlighted piece of `code` with its classes. */
function classesOf(code: string): Map<string, string> {
  const pieces = new Map<string, string>();
  highlightCode(
    code,
    htmlLanguage.parser.parse(code),
    codeHighlighters,
    (text, classes) => {
      if (classes) {
        pieces.set(text, classes);
      }
    },
    () => undefined,
  );
  return pieces;
}

describe("codeHighlighters", () => {
  it("marks HTML tag and attribute names so themes can color them", () => {
    const pieces = classesOf('<div id="page-header"></div>');
    expect(pieces.get("div")?.split(" ")).toContain("tok-tagName");
    expect(pieces.get("id")?.split(" ")).toContain("tok-attributeName");
    expect(pieces.get('"page-header"')).toBe("tok-string");
  });
});
