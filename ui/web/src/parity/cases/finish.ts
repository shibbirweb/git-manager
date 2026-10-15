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
