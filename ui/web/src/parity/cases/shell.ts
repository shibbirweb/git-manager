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
    id: "activity-bar",
    sources: ["src/lib/views/ActivityBar.svelte"],
    html:
      `<nav class="activity"><button class="item">${iconSvg("file", 19, 1.8)}</button>` +
      `<button class="item active">${iconSvg("git-compare", 19, 1.8)}</button></nav>`,
    pairs: [
      { name: "bar", ref: ".activity", lib: ".activity", ignore: { height: "the window's height" } },
      { name: "item", ref: ".item:not(.active)", lib: ".item:not(.active)", states: ["hover"] },
      { name: "active", ref: ".item.active", lib: ".item.active" },
      { name: "indicator", ref: ".item.active", lib: ".item.active", pseudo: "::before" },
      { name: "icon", ref: ".item:not(.active) svg", lib: ".item:not(.active) svg" },
    ],
  },
  {
    id: "resize-handle",
    sources: ["src/lib/ui/ResizeHandle.svelte"],
    html: '<div style="display: flex; height: 120px"><div class="handle" tabindex="0"></div></div>',
    pairs: [
      { name: "handle", ref: ".handle", lib: ".handle", ignore: { height: "the panel's height" } },
      {
        name: "line",
        ref: ".handle",
        lib: ".handle",
        pseudo: "::after",
        states: ["hover"],
        ignore: { height: "the panel's height" },
      },
    ],
  },
  {
    id: "search-toggles",
    sources: ["src/lib/ui/SearchToggles.svelte"],
    html:
      '<div class="toggles"><button class="toggle">Cc</button><button class="toggle on">W</button>' +
      '<button class="toggle">.*</button></div>' +
      '<div class="toggles compact"><button class="toggle">Cc</button><button class="toggle on">W</button>' +
      '<button class="toggle">.*</button></div>',
    pairs: [
      {
        name: "off",
        ref: ".toggles:not(.compact) .toggle:nth-child(1)",
        lib: ".toggles:not(.compact) .toggle:nth-child(1)",
        states: ["hover"],
      },
      { name: "on", ref: ".toggles:not(.compact) .toggle.on", lib: ".toggles:not(.compact) .toggle.on" },
      { name: "compact", ref: ".compact .toggle:nth-child(1)", lib: ".compact .toggle:nth-child(1)" },
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
