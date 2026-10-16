import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentsDir = fileURLToPath(new URL("../components/", import.meta.url));

/** Pixel values left in a component's <style> after hairlines (1px) and the small soft shadows are set aside. */
function literalPixels(source: string): string[] {
  const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? "";
  return style
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/0 1px 2px/g, "").replace(/(^|[^\d.])1px/g, "$1"))
    .filter((line) => /\d(\.\d+)?px/.test(line))
    .map((line) => line.trim());
}

describe("component styles", () => {
  it("take every size from a token, so native apps get the same values (1px lines aside)", () => {
    const found = readdirSync(componentsDir)
      .filter((file) => file.endsWith(".svelte"))
      .flatMap((file) => literalPixels(readFileSync(componentsDir + file, "utf8")).map((line) => `${file}: ${line}`));
    expect(found).toEqual([]);
  });
});
