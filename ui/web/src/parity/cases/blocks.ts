import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const SWATCH =
  "--sw-bg: #272822; --sw-fg: #f8f8f2; --sw-keyword: #f92672; --sw-string: #e6db74; --sw-selection: #49483e; " +
  "--sw-accent: #a6e22e; --sw-border: #3e3d32";

export const blockCases: ParityCase[] = [
  {
    id: "description-list",
    sources: ["src/lib/log/CommitDetails.svelte"],
    html: '<dl class="meta" style="margin: 0"><dt>Author</dt><dd>Ada</dd><dt>Date</dt><dd>11 Oct 2026</dd></dl>',
    pairs: [
      { name: "list", ref: ".meta", lib: ".meta", ignore: { width: "fills the details" } },
      { name: "label", ref: "dt", lib: "dt" },
      { name: "value", ref: "dd", lib: "dd", ignore: { width: "fills the column" } },
    ],
  },
  {
    id: "code-block",
    sources: ["src/lib/console/GitConsoleView.svelte"],
    html: '<div class="output" style="margin: 0"><pre class="block">$ git fetch origin</pre></div>',
    pairs: [
      {
        name: "output box",
        ref: ".output",
        lib: ".block.output",
        ignore: {
          width: "fills the console",
          height: "follows the text",
          "font-family": "the app sets the text on the pre inside (compared below)",
          "font-size": "the app sets the text on the pre inside",
          "line-height": "the app sets the text on the pre inside",
          "white-space": "the app sets the text on the pre inside",
        },
      },
      {
        name: "output text",
        ref: ".block",
        lib: ".block.output",
        ignore: Object.fromEntries(
          ["width", "height", "padding-top", "padding-right", "padding-bottom", "padding-left", "background-color"]
            .concat(["border-left-width", "border-left-style", "border-top-style", "border-left-color"])
            .map((property) => [property, "the app draws the box on the outer div (compared above)"]),
        ),
      },
    ],
  },
];
