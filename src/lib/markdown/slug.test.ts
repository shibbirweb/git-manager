import { describe, expect, it } from "vitest";
import { githubSlug, Slugger } from "./slug";

describe("githubSlug", () => {
  it("matches GitHub's heading ids", () => {
    expect(githubSlug("Hello World")).toBe("hello-world");
    expect(githubSlug("  What's new? (v1.2)  ")).toBe("whats-new-v12");
    expect(githubSlug("snake_case and kebab-case")).toBe("snake_case-and-kebab-case");
    expect(githubSlug("Café ünïcode 日本")).toBe("café-ünïcode-日本");
    expect(githubSlug("A  B")).toBe("a--b");
  });

  it("numbers repeated headings", () => {
    const slugger = new Slugger();
    expect(slugger.slug("Usage")).toBe("usage");
    expect(slugger.slug("Usage")).toBe("usage-1");
    expect(slugger.slug("Usage")).toBe("usage-2");
    expect(slugger.slug("Usage 1")).toBe("usage-1-1");
  });
});
