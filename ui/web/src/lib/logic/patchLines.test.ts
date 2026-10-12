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
});
