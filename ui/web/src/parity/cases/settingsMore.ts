import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const FILL = { width: "fills its parent" };

export const settingsMoreCases: ParityCase[] = [
  {
    id: "settings-nav",
    sources: ["src/lib/views/SettingsDialog.svelte"],
    html:
      '<div class="dialog" style="position: static; display: flex; height: 300px"><nav class="nav">' +
      '<h2 class="drag-handle">Settings</h2><div class="nav-empty">Nothing found</div><div class="nav-spacer"></div>' +
      '<button class="nav-item reset">Reset to Defaults</button></nav></div>',
    pairs: [
      { name: "nav", ref: ".nav", lib: ".dialog .nav", ignore: { height: "the dialog's height" } },
      {
        name: "title",
        ref: ".drag-handle",
        lib: ".dialog .nav h2",
        ignore: TEXT,
        appBugs: { "rest:font-weight": "Settings' title keeps the browser's bold 700; other dialog titles are 600" },
      },
      { name: "empty", ref: ".nav-empty", lib: ".nav .empty", ignore: FILL },
      { name: "reset", ref: ".reset", lib: ".nav-item.danger", ignore: FILL },
    ],
  },
  {
    id: "git-identity",
    sources: ["src/lib/views/settings/GitIdentitySettings.svelte"],
    html:
      '<div class="identity" style="width: 500px"><div class="block"><div class="block-head">' +
      '<span class="block-title">This repository</span><span class="repo-name">storefront</span>' +
      '<select class="input repo-select"><option>storefront</option></select></div>' +
      '<span class="hint">Used for commits here.</span><span class="warning">No email set.</span></div></div>',
    pairs: [
      { name: "title", ref: ".block-title", lib: '[aria-label="Identity"] .text:nth-child(1)', ignore: TEXT },
      { name: "repo", ref: ".repo-name", lib: '[aria-label="Identity"] .text:nth-child(2)', ignore: TEXT },
      {
        name: "picker",
        ref: ".repo-select",
        lib: "select",
        ignore: { ...TEXT, "font-size": "drift: 13px here, Select small is 12px like Interactive Rebase's" },
      },
      { name: "hint", ref: ".hint", lib: '[aria-label="Notes"] .text:nth-child(1)', ignore: TEXT },
      { name: "warning", ref: ".warning", lib: '[aria-label="Notes"] .text:nth-child(2)', ignore: TEXT },
    ],
  },
  {
    id: "commit-template",
    sources: ["src/lib/views/settings/CommitTemplateSettings.svelte"],
    html:
      '<div class="templates" style="width: 500px"><div class="template"><div class="template-head">' +
      '<span class="name">Feature</span></div><textarea class="input text" rows="3">feat: </textarea></div>' +
      '<p class="hint">Templates fill the message.</p></div>',
    pairs: [
      { name: "name", ref: ".name", lib: '[aria-label="Template"] > .text', ignore: FILL },
      { name: "text", ref: "textarea", lib: "textarea", ignore: { ...FILL, height: "rows" } },
    ],
  },
];
