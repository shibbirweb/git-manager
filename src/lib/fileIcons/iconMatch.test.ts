import { describe, expect, it } from "vitest";
import materialJson from "../../../static/file-icons/material/map.json";
import minimalJson from "../../../static/file-icons/minimal/map.json";
import { type IconMap, iconFor, normalizeIconMap } from "./iconMatch";

const sample: IconMap = {
  source: "test",
  file: "file",
  extensions: { ts: "typescript", "spec.ts": "test-ts", md: "markdown" },
  names: { "readme.md": "readme", "package.json": "nodejs" },
  lightExtensions: { md: "markdown_light" },
  lightNames: {},
};

describe("iconFor", () => {
  it("matches the whole name first, ignoring case", () => {
    expect(iconFor(sample, "README.md", false)).toBe("readme");
    expect(iconFor(sample, "package.json", false)).toBe("nodejs");
  });

  it("prefers the longest extension", () => {
    expect(iconFor(sample, "app.spec.ts", false)).toBe("test-ts");
    expect(iconFor(sample, "App.TS", false)).toBe("typescript");
  });

  it("uses light variants only in light mode", () => {
    expect(iconFor(sample, "notes.md", true)).toBe("markdown_light");
    expect(iconFor(sample, "notes.md", false)).toBe("markdown");
  });

  it("falls back to the plain file icon", () => {
    expect(iconFor(sample, "unknown.xyz", false)).toBe("file");
    expect(iconFor(sample, "noextension", false)).toBe("file");
    expect(iconFor(sample, "trailing.", false)).toBe("file");
    expect(iconFor(sample, "", false)).toBe("file");
    expect(iconFor(sample, "constructor", false)).toBe("file");
    expect(iconFor(sample, "x.toString", false)).toBe("file");
  });
});

describe("normalizeIconMap", () => {
  it("defaults every part of a damaged map", () => {
    expect(normalizeIconMap(null)).toEqual({ source: "", file: "", extensions: {}, names: {}, lightExtensions: {}, lightNames: {} });
    const map = normalizeIconMap({ file: "file", extensions: { ts: "typescript" }, names: [1], lightNames: "x" });
    expect(map.names).toEqual({});
    expect(map.lightNames).toEqual({});
    expect(iconFor(map, "a.ts", false)).toBe("typescript");
  });

  it("ignores values that are not strings", () => {
    const map = normalizeIconMap({ file: "file", extensions: { ts: 5 } });
    expect(iconFor(map, "a.ts", false)).toBe("file");
  });
});

describe("the Material Icons map", () => {
  const map = normalizeIconMap(materialJson);

  it("knows the common types", () => {
    expect(iconFor(map, "index.php", false)).toBe("php");
    expect(iconFor(map, "main.ts", false)).toBe("typescript");
    expect(iconFor(map, "lib.rs", false)).toBe("rust");
    expect(iconFor(map, "App.svelte", false)).toBe("svelte");
    expect(iconFor(map, "Dockerfile", false)).toBe("docker");
    expect(iconFor(map, "whatever.unknown", false)).toBe("file");
  });

  it("has an SVG for every icon it names, and no other", () => {
    const icons = new Set([map.file, ...Object.values(map.extensions), ...Object.values(map.names), ...Object.values(map.lightExtensions), ...Object.values(map.lightNames)]);
    const files = new Set(Object.keys(import.meta.glob("/static/file-icons/material/*.svg")));
    expect([...icons].filter((icon) => !files.has(`/static/file-icons/material/${icon}.svg`))).toEqual([]);
    expect(files.size).toBe(icons.size);
  });
});

describe("the Minimal map", () => {
  const map = normalizeIconMap(minimalJson);

  it("gives a glyph and a tone", () => {
    expect(iconFor(map, "main.rs", false)).toBe("code orange");
    expect(iconFor(map, "package-lock.json", false)).toBe("lock gray");
    expect(iconFor(map, ".env.local", false)).toBe("key yellow");
    expect(iconFor(map, "backup.tar.gz", false)).toBe("archive orange");
    expect(iconFor(map, "whatever.unknown", false)).toBe("file gray");
  });
});
