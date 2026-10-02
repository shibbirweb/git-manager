import { describe, expect, it } from "vitest";
import { viewLabel } from "./memoryEvents";

describe("viewLabel", () => {
  it("names the view, the tab file and the panels", () => {
    expect(
      viewLabel({ shownView: "file", tabPath: "/w/README.md", markdownMode: "preview", leftPanel: "changes", bottomPanel: null }),
    ).toBe("view file, tab README.md, markdown preview, sidebar changes, panel closed");
    expect(viewLabel({ shownView: "log", tabPath: null, markdownMode: null, leftPanel: null, bottomPanel: "run" })).toBe(
      "view log, tab none, sidebar hidden, panel run",
    );
  });
});
