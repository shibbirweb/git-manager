import { iconSvg } from "../svg";
import type { ParityCase } from "../types";

const TEXT = { width: "follows its text" };
const FILL = { width: "fills its parent" };

export const finishCases: ParityCase[] = [
  {
    id: "find-problem",
    sources: ["src/lib/editor/FindBar.svelte"],
    html:
      '<div class="find-bar" role="search" style="width: 600px"><div class="grid with-chevron">' +
      '<div class="field find problem"><input value="(" /></div><div class="tools"><span class="counter problem">' +
      'Bad regex</span></div><div class="field replace"><input /></div><div class="replace-actions">' +
      '<button class="text">Replace</button></div></div></div>',
    pairs: [
      { name: "field", ref: ".field.problem", lib: ".field.problem", ignore: FILL },
      { name: "counter", ref: ".counter.problem", lib: ".counter.problem", ignore: TEXT },
      { name: "replace actions", ref: ".replace-actions", lib: ".replace-tools", ignore: FILL },
    ],
  },
  {
    id: "file-kinds",
    sources: ["src/lib/views/changes/FileRow.svelte"],
    html:
      '<span class="letter kind-added">A</span><span class="letter kind-typechange">T</span>' +
      '<span class="letter kind-deleted">D</span><span class="letter kind-renamed">R</span>' +
      '<span class="letter kind-conflicted">C</span>',
    pairs: ["added", "typechange", "deleted", "renamed", "conflicted"].map((kind) => ({
      name: kind,
      ref: `.kind-${kind}`,
      lib: `.letter.kind-${kind}`,
      ignore: { height: "inline in the reference" },
    })),
  },
  {
    id: "settings-error",
    sources: ["src/lib/views/SettingsDialog.svelte"],
    html:
      `<div class="error-banner" style="width: 500px">${iconSvg("alert", 16)}<div>Could not save.</div></div>` +
      '<p class="group-hint">Turning a feature off frees its memory.</p>' +
      '<input class="input number-input" value="13" />',
    pairs: [
      {
        name: "banner",
        ref: ".error-banner",
        lib: ".notice",
        ignore: {
          ...FILL,
          height: "drift: see font-size",
          "font-size": "drift: 12.5px here, a Notice card is 13px like the merge tool's",
          "column-gap": "drift: 10px here, a Notice card is 8px",
        },
      },
      { name: "hint", ref: ".group-hint", lib: '[aria-label="Hint"] .text', ignore: FILL },
      { name: "number", ref: ".number-input", lib: ".input" },
    ],
  },
  {
    id: "memory-minor",
    sources: ["src/lib/views/settings/MemoryFlag.svelte"],
    html: '<span class="memory-flag minor">+2 MB</span>',
    pairs: [
      {
        name: "flag",
        ref: ".memory-flag",
        lib: ".pill",
        ignore: { ...TEXT, cursor: "drift: the app shows a help cursor for its tooltip" },
      },
    ],
  },
  {
    id: "changes-diff-error",
    sources: ["src/lib/views/changes/ChangesDiff.svelte"],
    html: '<div class="error-title">Could not load the diff</div>',
    pairs: [{ name: "title", ref: ".error-title", lib: ".title", ignore: FILL }],
  },
  {
    id: "nav-bar-floating",
    sources: ["src/lib/navBar/NavigationBar.svelte"],
    html: '<nav class="nav-bar floating" style="position: static; transform: none">src</nav>',
    pairs: [
      {
        name: "bar",
        ref: ".nav-bar",
        lib: ".crumbs",
        ignore: { ...TEXT, transform: "placed by its parent", "justify-content": "one crumb, so it does not matter" },
      },
    ],
  },
  {
    id: "dialog-secondary",
    sources: ["src/lib/ui/DialogHost.svelte"],
    html:
      '<div class="dialog" style="width: 400px"><label class="field secondary"><span>Message</span>' +
      '<textarea class="input"></textarea></label></div>',
    pairs: [
      { name: "field", ref: ".field.secondary", lib: ".field", ignore: { ...FILL, height: "the textarea's rows" } },
    ],
  },
];
