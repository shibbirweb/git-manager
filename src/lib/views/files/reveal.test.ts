import { describe, expect, it } from "vitest";
import { revealLabel, terminalFolderFor } from "./reveal";

describe("revealLabel", () => {
  it("names the file manager of each platform", () => {
    expect(revealLabel("macOS")).toBe("Reveal in Finder");
    expect(revealLabel("Windows")).toBe("Reveal in File Explorer");
    expect(revealLabel("Linux")).toBe("Open Containing Folder");
    expect(revealLabel("Unknown")).toBe("Reveal in Finder");
  });
});

describe("terminalFolderFor", () => {
  it("uses a folder itself and a file's parent", () => {
    expect(terminalFolderFor("/work/app/src", true)).toBe("/work/app/src");
    expect(terminalFolderFor("/work/app/src/main.ts", false)).toBe("/work/app/src");
    expect(terminalFolderFor("/top.txt", false)).toBe("/");
  });
});
