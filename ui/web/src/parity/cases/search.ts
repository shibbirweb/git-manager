import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const FILL = { width: "fills its parent" };
const SEARCH = "src/lib/search/FileSearch.svelte";
const ROW = { cursor: "the row it sits in sets it" };

export const searchCases: ParityCase[] = [
  {
    id: "search-top",
    sources: [SEARCH],
    html:
      '<div class="popup" style="position: static; width: 700px"><div class="top"><span class="status">12 results' +
      '</span><span class="capped">Capped</span></div><div class="field replace"><span class="replace-indent">' +
      '</span><input class="query" placeholder="Replace with" /></div></div>',
    pairs: [
      { name: "top", ref: ".top", lib: ".scopes", ignore: FILL },
      { name: "capped", ref: ".capped", lib: '.scopes [aria-label="Capped"] .text', ignore: TEXT },
      { name: "replace", ref: ".field.replace", lib: ".field.replace", ignore: FILL },
      { name: "indent", ref: ".replace-indent", lib: ".field.replace .indent" },
    ],
  },
  {
    id: "quick-open-symbol",
    sources: ["src/lib/quickOpen/QuickOpen.svelte"],
    html:
      '<div class="list"><div class="row"><span class="indent" style="width: 14px"></span>' +
      '<span class="badge interface">I</span><span class="name">Cart</span><span class="container">in cart.ts</span>' +
      '</div><div class="row"><span class="badge function">f</span><span class="badge constant">c</span>' +
      '<kbd class="prefix">&gt;</kbd></div></div>',
    pairs: [
      { name: "indent", ref: ".indent", lib: ".indent" },
      { name: "interface", ref: ".badge.interface", lib: ".badge.interface" },
      { name: "function", ref: ".badge.function", lib: ".badge.function", ignore: ROW },
      { name: "constant", ref: ".badge.constant", lib: ".badge.constant", ignore: ROW },
      { name: "container", ref: ".container", lib: ".container", ignore: TEXT },
      { name: "prefix", ref: ".prefix", lib: ".prefix", ignore: TEXT },
    ],
  },
];
