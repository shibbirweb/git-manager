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
];
