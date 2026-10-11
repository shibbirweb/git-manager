// Holds the library to its docs and rules: every component has a doc and a story, each doc lists exactly the props
// the component reads, no component takes a class or style, colors come from tokens, and stories need no CSS.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hardCodedColors, restOmitsClassAndStyle, sourceProps } from "../logic/propsSource";
import { componentDocs } from "./index";
import { docOutputs } from "./outputs";

const webRoot = join(__dirname, "../../..");
const componentsDir = join(webRoot, "src/lib/components");
const storiesDir = join(webRoot, "src/showcase/stories");
const components = readdirSync(componentsDir)
  .filter((file) => file.endsWith(".svelte"))
  .map((file) => file.replace(/\.svelte$/, ""))
  .sort();

function source(name: string): string {
  return readFileSync(join(componentsDir, `${name}.svelte`), "utf8");
}

/** Colors the app itself writes literally; each one is listed with where it comes from. */
const ALLOWED_COLORS: Record<string, string[]> = {
  // The switch knob is white in every theme, like Settings' switch.
  Switch: ["#fff"],
};

describe("the docs", () => {
  it("cover every component exactly once, and nothing else", () => {
    expect(componentDocs.map((doc) => doc.name).sort()).toEqual(components);
  });

  it("list exactly the props each component reads, with the same defaults and bindables", () => {
    for (const doc of componentDocs) {
      const props = sourceProps(source(doc.name)) ?? [];
      expect([doc.name, doc.props.map((entry) => entry.name).sort()]).toEqual([
        doc.name,
        props.map((entry) => entry.name).sort(),
      ]);
      for (const entry of props.filter((candidate) => candidate.name !== "...rest")) {
        const documented = doc.props.find((candidate) => candidate.name === entry.name);
        const hasDefault = documented?.default !== undefined;
        const defaults = [doc.name, entry.name, "default"];
        expect([...defaults, hasDefault]).toEqual([...defaults, entry.hasDefault]);
        expect([doc.name, entry.name, "bindable", documented?.bindable ?? false]).toEqual([
          doc.name,
          entry.name,
          "bindable",
          entry.bindable,
        ]);
        expect([doc.name, entry.name, "required", documented?.required ?? false]).toEqual([
          doc.name,
          entry.name,
          "required",
          // Props inherited from HTML attributes (no line in Props) are optional.
          !entry.hasDefault && propLine(doc.name, entry.name) !== "" && !/\?:/.test(propLine(doc.name, entry.name)),
        ]);
      }
    }
  });

  it("are written out for AI agents: COMPONENTS.md and every page are up to date (bun run ui:docs)", () => {
    for (const output of docOutputs()) {
      expect([output.path, readFileSync(join(webRoot, output.path), "utf8")]).toEqual([output.path, output.content]);
    }
  });

  it("keep the generated pages within 120 columns and 300 lines", () => {
    for (const output of docOutputs()) {
      const lines = output.content.split("\n");
      const wide = lines.filter((line) => line.length > 120 && !line.startsWith("<"));
      expect([output.path, lines.length <= 301, wide]).toEqual([output.path, true, []]);
    }
  });

  it("give every component a summary, usage and at least one example", () => {
    for (const doc of componentDocs) {
      expect([doc.name, doc.summary.length > 0, doc.usage.length > 0, doc.examples.length > 0]).toEqual([
        doc.name,
        true,
        true,
        true,
      ]);
    }
  });
});

/** The `name?: type` or `name: type` line of the component's Props interface (not of other interfaces). */
function propLine(component: string, name: string): string {
  const text = source(component);
  const start = text.indexOf("interface Props");
  const block = start < 0 ? "" : text.slice(start, text.indexOf("\n  }", start));
  return new RegExp(`^\\s*${name}\\??:.*$`, "m").exec(block)?.[0] ?? "";
}

describe("the components", () => {
  it("never take a class or style: a rest pass-through leaves them out", () => {
    for (const name of components) {
      const props = sourceProps(source(name)) ?? [];
      const names = props.map((entry) => entry.name);
      expect([name, names.includes("class") || names.includes("style")]).toEqual([name, false]);
      if (names.includes("...rest")) {
        expect([name, restOmitsClassAndStyle(source(name))]).toEqual([name, true]);
      }
    }
  });

  it("take colors from the theme tokens, not literal values", () => {
    for (const name of components) {
      expect([name, hardCodedColors(source(name))]).toEqual([name, ALLOWED_COLORS[name] ?? []]);
    }
  });

  it("each have a story that uses no CSS of its own", () => {
    for (const name of components) {
      const story = readFileSync(join(storiesDir, `${name}.story.svelte`), "utf8");
      expect([name, story.includes("<style")]).toEqual([name, false]);
    }
  });
});
