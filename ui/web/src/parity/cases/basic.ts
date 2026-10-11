import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const SETTINGS = "src/lib/views/SettingsDialog.svelte";

export const basicCases: ParityCase[] = [
  {
    id: "button",
    sources: ["src/lib/ui/DialogHost.svelte"],
    html:
      '<div class="row"><button class="btn">Cancel</button><button class="btn primary">Commit</button>' +
      '<button class="btn danger">Discard</button><button class="btn primary danger-fill">Delete</button>' +
      '<button class="btn" disabled>Disabled</button><button class="btn small">Small</button></div>',
    pairs: [
      { name: "default", ref: ".btn:nth-child(1)", lib: "button:nth-child(1)", states: ["hover"] },
      { name: "primary", ref: ".btn:nth-child(2)", lib: "button:nth-child(2)", states: ["hover"] },
      { name: "danger", ref: ".btn:nth-child(3)", lib: "button:nth-child(3)" },
      {
        name: "danger primary",
        ref: ".btn:nth-child(4)",
        lib: "button:nth-child(4)",
        states: ["hover"],
        appBugs: {
          "hover:background-color":
            "DialogHost's danger confirm turns blue on hover: .btn.primary:hover outweighs .danger-fill",
        },
      },
      { name: "disabled", ref: ".btn:nth-child(5)", lib: "button:nth-child(5)" },
      { name: "small", ref: ".btn:nth-child(6)", lib: "button:nth-child(6)" },
    ],
  },
  {
    id: "icon-button",
    sources: [],
    html: `<div class="row"><button class="icon-btn">${iconSvg("refresh")}</button></div>`,
    pairs: [{ name: "icon button", ref: ".icon-btn", lib: "button", states: ["hover"] }],
  },
  {
    id: "input",
    sources: [],
    html:
      '<div class="col"><input class="input" value="feature/login" />' +
      '<textarea class="input" rows="3">fix: a typo</textarea></div>',
    pairs: [
      { name: "input", ref: "input", lib: "input", states: ["focus"] },
      { name: "textarea", ref: "textarea", lib: "textarea" },
    ],
  },
  {
    id: "select",
    sources: [SETTINGS],
    html: '<select class="input select"><option>Bar</option><option>Block</option></select>',
    pairs: [{ name: "select", ref: "select", lib: "select" }],
  },
  {
    id: "switch",
    sources: [SETTINGS],
    html:
      '<div class="row"><input type="checkbox" class="switch" />' +
      '<input type="checkbox" class="switch" checked /></div>',
    pairs: [
      { name: "off", ref: ".switch:nth-child(1)", lib: "input:nth-child(1)" },
      { name: "on", ref: ".switch:nth-child(2)", lib: "input:nth-child(2)" },
      { name: "knob", ref: ".switch:nth-child(2)", lib: "input:nth-child(2)", pseudo: "::after" },
    ],
  },
  {
    id: "segmented",
    sources: [SETTINGS],
    html:
      '<div class="segmented" role="radiogroup"><button class="on">Light</button><button>Dark</button>' +
      "<button>System</button></div>",
    pairs: [
      { name: "group", ref: ".segmented", lib: ".segmented", ignore: { width: "the group fits its content" } },
      { name: "chosen", ref: "button.on", lib: "button.on" },
      { name: "other", ref: "button:nth-child(2)", lib: "button:nth-child(2)", states: ["hover"] },
    ],
  },
  {
    id: "slider",
    sources: [SETTINGS],
    html:
      '<div class="range"><input type="range" min="10" max="24" value="13" />' +
      '<span class="value">13 px</span></div>',
    pairs: [
      { name: "range", ref: ".range", lib: ".range" },
      { name: "track", ref: "input", lib: "input" },
      { name: "value", ref: ".value", lib: ".value" },
    ],
  },
  {
    id: "search-field",
    sources: [SETTINGS],
    html:
      `<div class="search"><span class="magnifier">${iconSvg("search", 13)}</span>` +
      '<input type="text" placeholder="Search settings" value="font" />' +
      `<button class="clear">${iconSvg("x", 12)}</button></div>`,
    pairs: [
      { name: "box", ref: ".search", lib: ".search", ignore: { width: "the Settings box fills its sidebar" } },
      { name: "input", ref: "input", lib: "input", ignore: { width: "follows the box" } },
      { name: "clear", ref: ".clear", lib: ".clear", states: ["hover"] },
    ],
  },
  {
    id: "setting-row",
    sources: [SETTINGS],
    html:
      '<div class="row"><div class="label"><span>Word wrap</span><span class="hint">Wrap long lines.</span></div>' +
      '<input type="checkbox" class="switch" /></div>',
    pairs: [
      { name: "row", ref: ".row", lib: ".row" },
      { name: "title", ref: ".label > span:first-child", lib: ".title" },
      { name: "hint", ref: ".hint", lib: ".hint" },
    ],
  },
];
