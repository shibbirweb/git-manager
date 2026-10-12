import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };
const DRIFT = "Reset's modes put 8 px after the radio; every other dialog's radios put 6 px";

export const moreCases: ParityCase[] = [
  {
    id: "underline-tabs",
    sources: ["src/lib/search/SearchTabs.svelte"],
    html: '<div class="tabs"><button class="tab active">All</button><button class="tab">Files</button></div>',
    pairs: [
      { name: "tabs", ref: ".tabs", lib: ".tabs", ignore: TEXT },
      { name: "active", ref: ".tab.active", lib: ".tab.selected", ignore: TEXT },
      { name: "tab", ref: ".tab:not(.active)", lib: ".tab:not(.selected)", states: ["hover"], ignore: TEXT },
    ],
  },
  {
    id: "changes-empty",
    sources: ["src/lib/views/ChangesView.svelte"],
    html:
      `<div class="placeholder"><div class="clean-icon">${iconSvg("check", 18)}</div>` +
      '<div class="empty-title">All committed</div></div>',
    pairs: [
      { name: "circle", ref: ".clean-icon", lib: ".circle" },
      { name: "title", ref: ".empty-title", lib: ".title", ignore: FILL },
    ],
  },
  {
    id: "no-repository",
    sources: ["src/lib/views/NoRepository.svelte"],
    html:
      `<div class="no-repo"><span class="icon">${iconSvg("folder-git", 18)}</span>` +
      '<p class="title">No repo</p></div>',
    pairs: [
      {
        name: "title",
        ref: ".title",
        lib: ".title",
        ignore: {
          ...FILL,
          height: "NoRepository's title is a paragraph at 1.5 line height; the Changes panel's is not; one style",
          "line-height": "NoRepository's title is a paragraph at 1.5 line height; the Changes panel's is not",
        },
      },
    ],
  },
  {
    id: "gist-parts",
    sources: ["src/lib/views/github/CreateGistDialog.svelte"],
    html:
      '<div class="segmented"><button class="on">Secret</button><button>Public</button></div>' +
      '<pre class="preview">let a = 1;</pre>',
    pairs: [
      { name: "joined", ref: ".segmented", lib: ".segmented.joined", ignore: TEXT },
      { name: "on", ref: ".segmented button.on", lib: ".segmented .on", ignore: TEXT },
      { name: "off", ref: ".segmented button:not(.on)", lib: ".segmented button:not(.on)", ignore: TEXT },
      { name: "preview", ref: ".preview", lib: ".preview", ignore: FILL },
    ],
  },
  {
    id: "commit-options",
    sources: ["src/lib/views/changes/CommitOptionsPopover.svelte"],
    html:
      `<button class="btn small gear">${iconSvg("settings", 13)}<span class="badge">2</span></button>` +
      '<div class="segments" style="width: 240px"><label class="segment selected">Sign</label>' +
      '<label class="segment">Off</label></div>',
    pairs: [
      { name: "badge", ref: ".badge", lib: ".badge.corner" },
      { name: "segments", ref: ".segments", lib: ".segmented.split", ignore: FILL },
      { name: "selected", ref: ".segment.selected", lib: ".split .on", ignore: FILL },
    ],
  },
  {
    id: "memory-flag",
    sources: ["src/lib/views/settings/MemoryFlag.svelte"],
    html: '<span class="memory-flag" style="margin: 0">+60 MB</span>',
    pairs: [{ name: "flag", ref: ".memory-flag", lib: ".pill.outline", ignore: { ...TEXT, cursor: "a help cursor" } }],
  },
  {
    id: "reset-modes",
    sources: ["src/lib/views/git/ResetDialog.svelte"],
    html:
      '<label class="mode"><input type="radio" /><span class="mode-text"><span class="mode-label danger">Hard' +
      '</span><span class="hint">Throw away.</span></span></label>',
    pairs: [
      {
        name: "mode",
        ref: ".mode",
        lib: ".radio",
        ignore: { ...FILL, "column-gap": DRIFT, height: "the reference hint has no dialog font size" },
      },
      { name: "label", ref: ".mode-label", lib: ".label.danger", ignore: { width: "follows the wider hint" } },
    ],
  },
  {
    id: "branch-file-list",
    sources: ["src/lib/views/git/BranchFileList.svelte"],
    html:
      '<div class="files"><div class="file selected"><span class="status status-added">A</span>' +
      '<span class="name truncate">cart.ts</span><span class="dir dim truncate">src</span></div></div>',
    pairs: [
      { name: "row", ref: ".file", lib: ".row.list", states: ["hover"], ignore: FILL },
      { name: "status", ref: ".status", lib: ".letter" },
      { name: "dir", ref: ".dir", lib: ".directory", ignore: { ...FILL, height: "a span in the row's text" } },
    ],
  },
];
