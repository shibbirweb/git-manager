import { describe, expect, it } from "vitest";
import {
  countWords,
  findLinks,
  type Manifest,
  manifestProblems,
  MAX_WORDS,
  pageName,
  pageProblems,
  resolvePath,
  rewriteLinks,
  stripTitle,
} from "./wiki";

const BLOB = "https://github.com/owner/repo/blob/develop";

describe("links", () => {
  const page = [
    "# Merge tool",
    "",
    "See [conflicts](Resolving-Conflicts.md#steps), [how it works](../developer/How-the-Merge-Tool-Works.md),",
    "the [changelog](../../../CHANGELOG.md), [GitHub](https://github.com) and [above](#top).",
    "",
    "![Three panes](../images/merge-tool.png)",
    "",
    "Inline `[not](a-link.md)` stays.",
    "",
    "```md",
    "[code](Example.md)",
    "```",
  ].join("\n");

  it("finds links outside code", () => {
    expect(findLinks(page).map((link) => link.target)).toEqual([
      "Resolving-Conflicts.md",
      "../developer/How-the-Merge-Tool-Works.md",
      "../../../CHANGELOG.md",
      "https://github.com",
      "",
      "../images/merge-tool.png",
    ]);
  });

  it("rewrites them for the flat wiki", () => {
    const rewritten = rewriteLinks(page, "docs/wiki/usage/Merge-Tool.md", BLOB);
    expect(rewritten).toContain("[conflicts](Resolving-Conflicts#steps)");
    expect(rewritten).toContain("[how it works](How-the-Merge-Tool-Works)");
    expect(rewritten).toContain(`[changelog](${BLOB}/CHANGELOG.md)`);
    expect(rewritten).toContain("[GitHub](https://github.com)");
    expect(rewritten).toContain("[above](#top)");
    expect(rewritten).toContain("![Three panes](images/merge-tool.png)");
    expect(rewritten).toContain("`[not](a-link.md)`");
    expect(rewritten).toContain("[code](Example.md)");
  });

  it("resolves relative paths", () => {
    expect(resolvePath("docs/wiki/usage/A.md", "../images/b.png")).toBe("docs/wiki/images/b.png");
    expect(resolvePath("docs/wiki/usage/A.md", "./B.md")).toBe("docs/wiki/usage/B.md");
    expect(pageName("docs/wiki/usage/Merge-Tool.md")).toBe("Merge-Tool");
  });
});

describe("pages", () => {
  it("drops the title the wiki prints itself", () => {
    expect(stripTitle("# Title\n\nBody.\n")).toBe("Body.\n");
  });

  it("counts prose words only", () => {
    expect(countWords("# Hi there\n\nOne [two](x.md) three.\n\n```\nnot counted at all\n```\n")).toBe(5);
  });

  it("reports style problems", () => {
    expect(pageProblems("# Fine\n\nText.\n")).toEqual([]);
    expect(pageProblems("No title")).toContain("does not start with a `# Title` line");
    expect(pageProblems("# T\n\nA \u2014 B")[0]).toContain("em-dash");
    expect(pageProblems(`# T\n\n${"word ".repeat(MAX_WORDS + 1)}`)[0]).toContain("words long");
    expect(pageProblems("# T\n\n```mermaid\nflowchart LR\n  A --> B\n```\n")).toEqual([]);
    expect(pageProblems("# T\n\n```mermaid\nA --> B\n```\n")[0]).toContain("diagram type");
  });
});

describe("manifest", () => {
  const manifest: Manifest = {
    usage: [{ page: "usage/Blame.md", summary: "" }],
    developer: [{ page: "developer/Architecture.md", summary: "" }],
    features: [{ id: "blame", title: "Blame", usage: "usage/Blame.md", developer: "developer/How-Blame-Works.md", screenshots: ["blame.png"] }],
  };

  it("accepts a consistent manifest", () => {
    expect(manifestProblems(manifest)).toEqual([]);
  });

  it("catches clashing names and unlisted usage pages", () => {
    const broken: Manifest = {
      ...manifest,
      developer: [...manifest.developer, { page: "developer/Blame.md", summary: "" }],
      features: [{ ...manifest.features[0], usage: "usage/Missing.md", screenshots: [] }],
    };
    const problems = manifestProblems(broken);
    expect(problems.some((problem) => problem.includes("would both become the wiki page Blame"))).toBe(true);
    expect(problems.some((problem) => problem.includes("usage/Missing.md"))).toBe(true);
    expect(problems.some((problem) => problem.includes("no screenshots"))).toBe(true);
  });
});
