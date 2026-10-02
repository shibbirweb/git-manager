import { describe, expect, it } from "vitest";
import { baseName, loadingChangesText, openingTitle } from "./openingProgress";

describe("opening progress text", () => {
  it("names the folder being opened", () => {
    expect(baseName("/work/acme/")).toBe("acme");
    expect(baseName("C:\\work\\acme")).toBe("acme");
    expect(openingTitle(["/work/acme"])).toBe("Opening acme");
    expect(openingTitle(["/a", "/b", "/c"])).toBe("Opening 3 folders");
  });

  it("counts the repositories still loading", () => {
    expect(loadingChangesText(0, 5)).toBe("Reading changes 1 of 5");
    expect(loadingChangesText(4, 5)).toBe("Reading changes 5 of 5");
    expect(loadingChangesText(0, 1)).toBe("Reading changes");
  });
});
