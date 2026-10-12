import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const GRADIENT = { "background-color": "the library puts the gradient's deep color under it for contrast checks" };

export const welcomeCases: ParityCase[] = [
  {
    id: "welcome-brand",
    sources: ["src/lib/views/Welcome.svelte"],
    html:
      '<nav class="sidebar" style="height: 200px"><div class="brand"><div class="brand-text">' +
      '<span class="app-name">Git Manager</span></div></div><div class="sidebar-foot">' +
      `<button class="icon-btn">${iconSvg("settings", 15)}</button></div></nav>` +
      `<div class="hello"><div class="logo big">${iconSvg("merge", 34)}</div><h1>Welcome to Git Manager</h1>` +
      '<p class="dim">Open a folder.</p></div>',
    pairs: [
      {
        name: "sidebar",
        ref: ".sidebar",
        lib: ".pane",
        ignore: {
          height: "set here",
          "padding-top": "a Stack inside sets the space",
          "padding-right": "a Stack inside sets the space",
          "padding-bottom": "a Stack inside sets the space",
          "padding-left": "a Stack inside sets the space",
        },
      },
      { name: "app name", ref: ".app-name", lib: ".pane .text", ignore: TEXT },
      { name: "settings", ref: ".sidebar-foot .icon-btn", lib: ".icon-button", states: ["hover"] },
      { name: "big logo", ref: ".logo.big", lib: ".logo.large" },
      { name: "title", ref: ".hello h1", lib: "h1", ignore: TEXT },
    ],
  },
  {
    id: "welcome-badges",
    sources: ["src/lib/views/Welcome.svelte"],
    html:
      '<span class="badge badge-blue">AB</span><span class="badge badge-green">CD</span>' +
      '<span class="badge badge-magenta">EF</span><span class="badge badge-red">GH</span>',
    pairs: [
      { name: "blue", ref: ".badge-blue", lib: ".avatar.blue", ignore: GRADIENT },
      { name: "green", ref: ".badge-green", lib: ".avatar.green", ignore: GRADIENT },
      { name: "magenta", ref: ".badge-magenta", lib: ".avatar.magenta", ignore: GRADIENT },
      { name: "red", ref: ".badge-red", lib: ".avatar.red", ignore: GRADIENT },
    ],
  },
  {
    id: "welcome-field",
    sources: ["src/lib/views/Welcome.svelte"],
    html:
      '<div class="page" style="width: 500px"><div class="field"><span class="field-label">Theme</span>' +
      '<select class="input"><option>Light</option></select></div><div class="field stacked">' +
      '<span class="field-label">Interface font size</span><input type="range" /></div></div>',
    pairs: [
      { name: "row", ref: ".field:not(.stacked)", lib: ".row.plain:not(.stacked)", ignore: { width: "fills" } },
      { name: "stacked", ref: ".field.stacked", lib: ".row.plain.stacked", ignore: { width: "fills", height: "x" } },
      { name: "label", ref: ".field-label", lib: ".row.plain .title", ignore: TEXT },
    ],
  },
];
