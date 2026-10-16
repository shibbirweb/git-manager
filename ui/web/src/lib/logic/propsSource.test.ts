import { describe, expect, it } from "vitest";
import { hardCodedColors, restOmitsClassAndStyle, sourceProps, splitTopLevel } from "./propsSource";

describe("splitTopLevel", () => {
  it("keeps commas inside brackets, generics and strings", () => {
    expect(splitTopLevel('a = 1, b = f(x, y), c = "p, q", d = `${a}, ${b}`, e = { x: 1, y: 2 }')).toEqual([
      "a = 1",
      "b = f(x, y)",
      'c = "p, q"',
      "d = `${a}, ${b}`",
      "e = { x: 1, y: 2 }",
    ]);
  });
});

describe("sourceProps", () => {
  it("reads names, defaults, bindables and the rest", () => {
    const source = 'let { value = $bindable(""), label, size = "normal", ...rest }: Props = $props();';
    expect(sourceProps(source)).toEqual([
      { name: "value", hasDefault: true, bindable: true },
      { name: "label", hasDefault: false, bindable: false },
      { name: "size", hasDefault: true, bindable: false },
      { name: "...rest", hasDefault: false, bindable: false },
    ]);
    expect(sourceProps("let { value = $bindable() }: Props = $props();")).toEqual([
      { name: "value", hasDefault: false, bindable: true },
    ]);
    expect(sourceProps("let { lineNumbers: numbered = true }: Props = $props();")).toEqual([
      { name: "lineNumbers", hasDefault: true, bindable: false },
    ]);
    expect(sourceProps("no props here")).toBeNull();
  });
});

describe("rules", () => {
  it("knows when a rest pass-through leaves out class and style", () => {
    const omitted = 'interface Props extends Omit<HTMLButtonAttributes, "class" | "style"> {';
    expect(restOmitsClassAndStyle(omitted)).toBe(true);
    expect(restOmitsClassAndStyle("interface Props extends HTMLButtonAttributes {")).toBe(false);
  });

  it("finds hard-coded colors in the style block only", () => {
    expect(hardCodedColors('<p style="x">#fff</p><style>a { color: #fff; b: rgba(0, 0, 0, 0.2); }</style>')).toEqual([
      "#fff",
      "rgba(0, 0, 0, 0.2)",
    ]);
  });
});
