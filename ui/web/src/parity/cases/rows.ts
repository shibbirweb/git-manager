import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };

export const rowCases: ParityCase[] = [
  {
    id: "sidebar-row",
    sources: ["src/lib/views/Sidebar.svelte", "src/lib/views/sidebar/RowContent.svelte"],
    html:
      '<div class="sidebar-row section" style="padding-left: 6px">' +
      `<span class="chevron">${iconSvg("chevron-down", 12)}</span><span class="section-label">Local</span>` +
      '<span class="count">3</span><span class="spacer"></span></div>' +
      '<div class="sidebar-row selected" style="padding-left: 32px">' +
      `<span class="icon current">${iconSvg("check", 14)}</span>` +
      '<span class="label truncate strong">main</span><span class="sync dim">' +
      `<span>2${iconSvg("arrow-up", 10)}</span></span></div>`,
    pairs: [
      { name: "section row", ref: ".sidebar-row.section", lib: ".sidebar-row.section", ignore: FILL },
      { name: "chevron", ref: ".section .chevron", lib: ".section .chevron" },
      { name: "section label", ref: ".section-label", lib: ".section-label" },
      { name: "count", ref: ".section .count", lib: ".section .count" },
      {
        name: "branch row",
        ref: ".sidebar-row.selected",
        lib: ".sidebar-row.selected",
        states: ["hover"],
        ignore: FILL,
      },
      { name: "current icon", ref: ".icon.current", lib: ".icon.current" },
      { name: "name", ref: ".label.strong", lib: ".label.strong", ignore: FILL },
      { name: "ahead", ref: ".sync", lib: ".sync" },
    ],
  },
  {
    id: "fieldset",
    sources: ["src/lib/views/git/PullDialog.svelte", "src/lib/views/git/GitDialogFrame.svelte"],
    html:
      '<div class="dialog"><fieldset class="modes"><legend class="hint">Integrate the incoming changes with</legend>' +
      '<label><input type="radio" name="m" checked /> Merge</label>' +
      '<label><input type="radio" name="m" /> Rebase</label></fieldset></div>',
    pairs: [
      {
        name: "fieldset",
        ref: ".modes",
        lib: ".fieldset",
        ignore: { ...FILL, height: "each dialog draws its own option rows; RadioGroup is checked on its own" },
      },
      { name: "legend", ref: "legend", lib: "legend", ignore: FILL },
    ],
  },
];
