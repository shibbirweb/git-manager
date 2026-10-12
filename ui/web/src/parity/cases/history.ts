import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const FILL = { width: "fills its parent" };
const DETAILS = "src/lib/log/CommitDetails.svelte";
const LETTER = { height: "a block in a row in the app", cursor: "the app's row" };
const BUG = "commit details color their status letters unlike the Changes panel (renamed violet, type change blue)";
const OPACITY = { "rest:opacity": "commit details draw letters fully; the Changes panel at 0.8" };
const colorBugs = (state: string, reason: string) =>
  Object.fromEntries(
    ["color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"].map((name) => [
      `${state}:${name}`,
      reason,
    ]),
  );
const COLORS = colorBugs("rest", BUG);

export const historyCases: ParityCase[] = [
  {
    id: "log-refs",
    sources: ["src/lib/views/LogView.svelte"],
    html:
      '<div style="--row-bg: var(--panel)"><span class="ref ref-more">+3</span><span class="ref bisect-bad">bad' +
      '</span><span class="ref bisect-good">good</span><span class="ref bisect-skip">skip</span>' +
      '<span class="ref bisect-current">current</span></div>',
    pairs: [
      { name: "more", ref: ".ref-more", lib: ".ref.more", ignore: TEXT },
      { name: "bad", ref: ".bisect-bad", lib: ".ref.bisect-bad", ignore: TEXT },
      { name: "good", ref: ".bisect-good", lib: ".ref.bisect-good", ignore: TEXT },
      { name: "skip", ref: ".bisect-skip", lib: ".ref.bisect-skip", ignore: TEXT },
      { name: "current", ref: ".bisect-current", lib: ".ref.bisect-current", ignore: TEXT },
    ],
  },
  {
    id: "details-parts",
    sources: [DETAILS],
    html:
      `<button class="btn small open-tab">${iconSvg("commit", 13)} Open in Tab</button>` +
      '<dd class="parents"><button class="parent mono">a1b2c3d</button></dd>' +
      '<div class="files-header dim" style="width: 300px">3 files changed</div>' +
      '<div class="file"><span class="status status-deleted">D</span></div>' +
      '<div class="file"><span class="status status-renamed">R</span></div>' +
      '<div class="file"><span class="status status-typechange">T</span></div>' +
      `<button class="icon-btn tiny">${iconSvg("copy", 13)}</button>`,
    pairs: [
      {
        name: "open tab",
        ref: ".open-tab",
        lib: ".button",
        states: ["hover"],
        ignore: { ...TEXT, "column-gap": "drift: 5px here, a small Button is 6px" },
      },
      { name: "parent", ref: ".parent", lib: ".link", states: ["hover"], ignore: TEXT },
      { name: "files header", ref: ".files-header", lib: ".section-title", ignore: FILL },
      { name: "deleted", ref: ".status-deleted", lib: ".letter.kind-deleted", ignore: LETTER, appBugs: OPACITY },
      { name: "renamed", ref: ".status-renamed", lib: ".letter.kind-renamed", ignore: LETTER, appBugs: COLORS },
      {
        name: "typechange",
        ref: ".status-typechange",
        lib: ".letter.kind-typechange",
        ignore: LETTER,
        appBugs: COLORS,
      },
      {
        name: "tiny",
        ref: ".tiny",
        lib: ".icon-button",
        states: ["hover"],
        appBugs: colorBugs("hover", "commit details' small buttons stay dim on hover; other dim buttons brighten"),
      },
    ],
  },
  {
    id: "merge-groups",
    sources: ["src/lib/merge/MergeEditor.svelte"],
    html:
      '<div class="toolbar"><div class="group"><button class="icon-btn">' +
      `${iconSvg("chevrons-right", 15)}</button><button class="icon-btn wand">${iconSvg("wand", 15)}` +
      '<span>Apply non-conflicting</span></button></div></div><div class="footer"><span class="status conflicts">' +
      '2 conflicts</span><span class="status done">All resolved</span></div>',
    pairs: [
      { name: "group", ref: ".toolbar .group", lib: '[aria-label="Apply"]', ignore: TEXT },
      { name: "wand", ref: ".wand", lib: ".icon-button:last-child", states: ["hover"], ignore: TEXT },
      { name: "wand text", ref: ".wand span", lib: ".icon-button:last-child .text", ignore: TEXT },
      { name: "conflicts", ref: ".status.conflicts", lib: '[aria-label="Status"] .text:first-child', ignore: TEXT },
      { name: "done", ref: ".status.done", lib: '[aria-label="Status"] .text:last-child', ignore: TEXT },
    ],
  },
];
