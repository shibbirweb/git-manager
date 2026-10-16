import { describe, expect, it } from "vitest";
import { cellText } from "./table";

describe("cellText", () => {
  it("reads the row's value under the column id", () => {
    const column = { id: "author", label: "Author", width: "medium" as const };
    expect(cellText({ author: "Ada" }, column)).toBe("Ada");
    expect(cellText({ author: 3 }, column)).toBe("3");
    expect(cellText({}, column)).toBe("");
    expect(cellText(null, column)).toBe("");
  });
});
