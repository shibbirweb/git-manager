import { describe, expect, it } from "vitest";
import { badgeColor } from "$lib/views/welcomeModel";
import { projectTintFor } from "./projectTint";

describe("projectTintFor", () => {
  it("uses the Welcome tile's color of the open workspace", () => {
    expect(projectTintFor(true, "/Users/me/kpd")).toBe(badgeColor("/Users/me/kpd"));
    expect(projectTintFor(true, "/a\n/b")).toBe(badgeColor("/a\n/b"));
  });

  it("shows no color when turned off or with nothing open", () => {
    expect(projectTintFor(false, "/Users/me/kpd")).toBe("none");
    expect(projectTintFor(true, null)).toBe("none");
  });
});
