import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const FILL = { width: "fills its parent" };

export const dialogCases: ParityCase[] = [
  {
    id: "patch-head",
    sources: ["src/lib/views/git/LineHistoryTab.svelte"],
    html: '<div class="patch-pane" style="width: 500px"><div class="patch-head">Lines 10 to 20</div></div>',
    pairs: [{ name: "head", ref: ".patch-head", lib: ".toolbar", ignore: FILL }],
  },
  {
    id: "push-commit-list",
    sources: ["src/lib/views/git/PushDialog.svelte"],
    html:
      '<div class="commits" style="width: 400px"></div><span class="local">main</span>',
    pairs: [
      {
        name: "list",
        ref: ".commits",
        lib: ".list-box",
        ignore: { ...FILL, height: "drift: 120 to 260px here, ListBox has list and small presets" },
      },
    ],
  },
  {
    id: "gist-parts",
    sources: ["src/lib/views/github/CreateGistDialog.svelte"],
    html:
      '<div class="segmented"><button type="button" class="on">Secret</button><button type="button">Public' +
      '</button></div><pre class="preview" style="width: 400px">const a = 1;</pre>',
    pairs: [
      { name: "segmented", ref: ".segmented", lib: ".segmented", ignore: TEXT },
      { name: "on", ref: ".segmented button.on", lib: ".segmented button.on", ignore: TEXT },
      { name: "off", ref: ".segmented button:not(.on)", lib: ".segmented button:not(.on)", ignore: TEXT },
      { name: "preview", ref: ".preview", lib: ".block", ignore: FILL },
    ],
  },
  {
    id: "older-toggle",
    sources: ["src/lib/update/WhatsNewDialog.svelte"],
    html: `<button class="older-toggle">${iconSvg("chevron-right", 12)} Earlier versions</button>`,
    pairs: [
      {
        name: "toggle",
        ref: ".older-toggle",
        lib: ".link",
        states: ["hover"],
        ignore: {
          ...TEXT,
          height: "the space around it comes from the caller's Stack",
          "padding-top": "the space around it comes from the caller's Stack",
          "padding-bottom": "the space around it comes from the caller's Stack",
        },
        appBugs: Object.fromEntries(
          ["color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"].map(
            (name) => [`hover:${name}`, "What's New's toggle stays dim on hover; other dim links brighten"],
          ),
        ),
      },
    ],
  },
];
