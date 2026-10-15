import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };

export const shellCases: ParityCase[] = [
  {
    id: "status-bar",
    sources: ["src/lib/views/StatusBar.svelte"],
    html:
      '<footer class="status-bar"><div class="left"><button class="item">' +
      `${iconSvg("branch", 13)}<span>main</span></button><span class="item">3 changes</span></div>` +
      `<div class="right"><button class="item open">${iconSvg("memory", 13)}` +
      "<span>181 MB</span></button></div></footer>",
    pairs: [
      { name: "bar", ref: ".status-bar", lib: ".status-bar", ignore: FILL },
      { name: "button item", ref: "button.item:not(.open)", lib: "button.item:not(.open)", states: ["hover"] },
      {
        name: "text item",
        ref: "span.item",
        lib: "span.item",
        appBugs: { "rest:cursor": "the app shows a pointer on status bar text that cannot be clicked" },
      },
      { name: "open item", ref: ".item.open", lib: ".item.open" },
    ],
  },
  {
    id: "find-bar",
    sources: ["src/lib/editor/FindBar.svelte"],
    html:
      '<div class="find-bar"><div class="grid with-chevron">' +
      `<button class="icon chevron">${iconSvg("chevron-right", 14)}</button>` +
      `<div class="field find"><span class="magnifier">${iconSvg("search", 13)}</span><input value="total" /></div>` +
      '<div class="tools"><span class="counter">1 of 4</span>' +
      `<button class="icon">${iconSvg("arrow-up", 14)}</button></div>` +
      `<button class="icon close">${iconSvg("x", 14)}</button></div></div>`,
    pairs: [
      { name: "bar", ref: ".find-bar", lib: ".find-bar", ignore: FILL },
      { name: "field", ref: ".field.find", lib: ".field.find", ignore: FILL },
      { name: "counter", ref: ".counter", lib: ".counter" },
      { name: "button", ref: ".tools .icon", lib: ".tools .icon", states: ["hover"] },
    ],
  },
];
