import { describe, expect, it } from "vitest";
import type { ReflogEntry } from "$lib/types";
import { hasCommit, reflogActionLabel, reflogActionTone } from "./reflogView";

describe("reflogView", () => {
  it("labels each action", () => {
    expect(reflogActionLabel("cherryPick")).toBe("cherry-pick");
    expect(reflogActionLabel("initialCommit")).toBe("first commit");
    expect(reflogActionLabel("amend")).toBe("amend");
  });

  it("knows entries without a commit", () => {
    const entry = { newId: "0".repeat(40) } as ReflogEntry;
    expect(hasCommit(entry)).toBe(false);
    expect(hasCommit({ ...entry, newId: "ab".repeat(20) })).toBe(true);
  });

  it("colors actions by what they did to history", () => {
    expect(reflogActionTone("amend")).toBe("success");
    expect(reflogActionTone("rebase")).toBe("danger");
    expect(reflogActionTone("checkout")).toBe("accent");
    expect(reflogActionTone("cherryPick")).toBe("warning");
    expect(reflogActionTone("clone")).toBe("dim");
  });
});
