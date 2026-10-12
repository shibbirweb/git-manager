import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const FILL = { width: "fills its parent" };
const TEXT = { width: "follows its text" };
const SECTION = "src/lib/views/changes/RepoSection.svelte";

export const sectionCases: ParityCase[] = [
  {
    id: "repo-actions",
    sources: ["src/lib/views/changes/RepoActions.svelte"],
    html:
      '<span class="repo-row-actions" style="width: 400px"><button class="action branch detached">' +
      `${iconSvg("branch", 12)}<span class="branch-text truncate">a1b2c3d</span><span class="decorations">` +
      `REBASING</span></button><button class="action sync">${iconSvg("sync", 13)}<span class="sync-badge">2↓ 1↑` +
      `</span></button><button class="action spinning">${iconSvg("refresh", 13)}</button></span>`,
    pairs: [
      { name: "sync", ref: ".sync", lib: ".icon-button.row:nth-of-type(1)", states: ["hover"], ignore: TEXT },
      { name: "sync count", ref: ".sync-badge", lib: ".icon-button .count", ignore: TEXT },
      {
        name: "refresh",
        ref: ".spinning",
        lib: ".icon-button.row:nth-of-type(2)",
        ignore: { gap: "the spinning icon sits in a span" },
      },
    ],
  },
  {
    id: "op-badge",
    sources: [SECTION],
    html: '<span class="op-badge">MERGING</span>',
    pairs: [{ name: "badge", ref: ".op-badge", lib: ".pill", ignore: { ...TEXT, "white-space": "one word" } }],
  },
  {
    id: "clean-list-head",
    sources: ["src/lib/views/changes/CleanRepoList.svelte"],
    html:
      '<div class="clean-list" style="width: 300px"><div class="list-header"><button class="list-toggle">' +
      `${iconSvg("chevron-down", 13)}<span class="list-label">No Changes</span><span class="list-count">3</span>` +
      "</button></div></div>",
    pairs: [
      {
        name: "header",
        ref: ".list-header",
        lib: ".header",
        states: ["hover"],
        ignore: { ...FILL, "column-gap": "the app's header holds only the toggle" },
      },
      { name: "toggle", ref: ".list-toggle", lib: ".toggle", ignore: FILL },
      { name: "title", ref: ".list-label", lib: ".title" },
      { name: "count", ref: ".list-count", lib: ".count" },
    ],
  },
  {
    id: "group-nested",
    sources: [SECTION],
    html:
      '<div class="group" style="width: 300px"><div class="group-header nested"><button class="group-toggle">' +
      `${iconSvg("chevron-down", 13)}<span class="group-label">Changes</span><span class="group-count">2</span>` +
      `</button><span class="group-actions"><button class="action">${iconSvg("plus", 13)}</button></span></div></div>`,
    pairs: [
      { name: "header", ref: ".group-header", lib: ".header", states: ["hover"], ignore: FILL },
      { name: "actions", ref: ".group-actions", lib: ".actions", ignore: TEXT },
    ],
  },
  {
    id: "no-repo",
    sources: ["src/lib/views/ChangesView.svelte"],
    html:
      '<div class="panel" style="width: 300px; height: 260px; display: flex"><div class="placeholder no-repo">' +
      `<div class="empty-icon">${iconSvg("folder-git", 20)}</div><div class="empty-title">No git repository</div>` +
      '<div class="dim">Initialize one here.</div><div class="empty-actions"><button class="btn small primary">' +
      "Initialize Repository</button></div></div></div>",
    pairs: [
      { name: "area", ref: ".placeholder", lib: ".empty", ignore: FILL },
      { name: "icon", ref: ".empty-icon", lib: ".circle" },
      { name: "title", ref: ".empty-title", lib: ".title", ignore: TEXT },
    ],
  },
  {
    id: "commit-options-panel",
    sources: ["src/lib/views/changes/CommitOptionsPopover.svelte"],
    html:
      '<div class="panel" style="position: static; width: 300px"><div class="heading">Commit Options</div>' +
      '<fieldset class="gpg"><legend>GPG sign</legend></fieldset><div class="hint">Applies to every commit.</div>' +
      "</div>",
    pairs: [
      { name: "panel", ref: ".panel", lib: ".popover", ignore: { ...FILL, height: "holds different parts" } },
      {
        name: "fieldset",
        ref: ".gpg",
        lib: ".fieldset",
        ignore: { ...FILL, "column-gap": "it holds one row of segments" },
      },
      { name: "legend", ref: "legend", lib: "legend", ignore: TEXT },
    ],
  },
];
