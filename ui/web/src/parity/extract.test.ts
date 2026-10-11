import { describe, expect, it } from "vitest";
import { scopeCss, styleOf } from "./extract";

describe("styleOf", () => {
  it("takes the style block of a component", () => {
    const source = "<script></script><p>x</p><style>\n  .a { color: red; }\n</style>";
    expect(styleOf(source)).toBe("\n  .a { color: red; }\n");
    expect(styleOf("<p>no style</p>")).toBe("");
  });
});

describe("scopeCss", () => {
  it("weighs combinators and pseudo-elements like Svelte's scoping", () => {
    expect(scopeCss(".a > .b::after { x: 1; }", "#r")).toBe(
      ":where(#r) .a:is(*, .gm-svelte-scope) > .b:is(*, .gm-svelte-scope)::after { x: 1; }\n",
    );
  });

  it("puts every selector under the scope and unwraps :global", () => {
    const css = ".tab, .tab:hover { color: red; }\n.strip :global(svg) { opacity: 0.8; }";
    const w = ":is(*, .gm-svelte-scope)";
    expect(scopeCss(css, "#ref")).toBe(
      `:where(#ref) .tab${w}, :where(#ref) .tab:hover${w} { color: red; }\n` +
        `:where(#ref) .strip${w} svg { opacity: 0.8; }\n`,
    );
  });

  it("drops rules aimed at the page root and comments", () => {
    const css = "/* note */ :global(html[data-x]) .a { color: red; } :root .b { x: 1; } .c { y: 2; }";
    expect(scopeCss(css, "#ref")).toBe(":where(#ref) .c:is(*, .gm-svelte-scope) { y: 2; }\n");
  });

  it("scopes inside @media and keeps @keyframes", () => {
    const css = "@media (max-width: 10px) { .a { x: 1; } }\n@keyframes spin { to { transform: rotate(1turn); } }";
    expect(scopeCss(css, "#ref")).toBe(
      "@media (max-width: 10px) {\n:where(#ref) .a:is(*, .gm-svelte-scope) { x: 1; }\n}\n" +
        "@keyframes spin { to { transform: rotate(1turn); } }\n",
    );
  });
});
