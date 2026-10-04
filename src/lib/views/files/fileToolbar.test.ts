import { describe, expect, it } from "vitest";
import { fileToolbarParts, type FileToolbarSwitches } from "./fileToolbar";

const allOn: FileToolbarSwitches = {
  breadcrumbs: true,
  badges: true,
  changes: true,
  blame: true,
  copyPath: true,
  markdownView: true,
  markdownFormat: true,
};
const gitMarkdown = { gitTools: true, markdown: true };
const plain = { gitTools: false, markdown: false };

describe("fileToolbarParts", () => {
  it("shows every part that applies to the file", () => {
    expect(fileToolbarParts("top", allOn, gitMarkdown)).toEqual({ shown: true, ...allOn });
    expect(fileToolbarParts("bottom", allOn, plain)).toEqual({
      shown: true,
      breadcrumbs: true,
      badges: true,
      changes: false,
      blame: false,
      copyPath: true,
      markdownView: false,
      markdownFormat: false,
    });
  });

  it("follows each switch", () => {
    const parts = fileToolbarParts("top", { ...allOn, breadcrumbs: false, blame: false, markdownView: false }, gitMarkdown);
    expect(parts).toMatchObject({ shown: true, breadcrumbs: false, blame: false, markdownView: false, changes: true, copyPath: true });
  });

  it("hides the bar when it is hidden or every part is off, but keeps the formatting row", () => {
    expect(fileToolbarParts("none", allOn, gitMarkdown)).toMatchObject({ shown: false, breadcrumbs: false, changes: false, markdownFormat: true });
    const off = { breadcrumbs: false, badges: false, changes: false, blame: false, copyPath: false, markdownView: false, markdownFormat: false };
    expect(fileToolbarParts("top", off, gitMarkdown).shown).toBe(false);
    // Only git buttons on, in a file outside a repository: nothing to show.
    expect(fileToolbarParts("top", { ...off, changes: true, blame: true }, plain).shown).toBe(false);
  });
});
