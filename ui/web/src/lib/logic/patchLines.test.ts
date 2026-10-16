import { describe, expect, it } from "vitest";
import { patchLineKind, patchLines } from "./patchLines";

describe("patch lines", () => {
  it("tells file headers from removed and added lines", () => {
    expect(patchLineKind("--- a/cart.ts")).toBe("file");
    expect(patchLineKind("+++ b/cart.ts")).toBe("file");
    expect(patchLineKind("diff --git a/cart.ts b/cart.ts")).toBe("file");
    expect(patchLineKind("rename from basket.ts")).toBe("file");
    expect(patchLineKind("-const tax = 0.2;")).toBe("deleted");
    expect(patchLineKind("+const tax = 0.25;")).toBe("added");
    expect(patchLineKind("--x")).toBe("deleted");
  });

  it("marks hunk headers and context", () => {
    expect(patchLineKind("@@ -1,3 +1,3 @@ export")).toBe("hunk");
    expect(patchLineKind(" unchanged")).toBe("context");
    expect(patchLineKind("")).toBe("context");
  });

  it("splits a patch without an empty last line", () => {
    expect(patchLines("@@ -1 +1 @@\n-a\n+b\n").map((line) => line.kind)).toEqual(["hunk", "deleted", "added"]);
    expect(patchLines("")).toEqual([]);
    expect(patchLines("\n")).toEqual([{ kind: "context", text: "" }]);
  });

  it("reads a removed line that starts with -- inside a hunk as removed, not a header", () => {
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -2,2 +2,2 @@",
      " keep",
      "-old",
      "+new",
      "--- not a header inside a hunk",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- a/src/b.ts",
      "",
    ].join("\n");
    expect(patchLines(patch).map((line) => line.kind)).toEqual([
      "file",
      "file",
      "file",
      "hunk",
      "context",
      "deleted",
      "added",
      "deleted",
      "file",
      "file",
    ]);
  });
});
