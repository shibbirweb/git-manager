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
