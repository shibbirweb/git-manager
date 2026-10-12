import { prop, type ComponentDoc } from "./types";

export const listDocs: ComponentDoc[] = [
  {
    name: "ListBox",
    group: "Layout",
    summary: "A bordered, scrolling box on the editor background holding a list inside a dialog.",
    usage: "Use for a push's commits or the remotes; rows draw their own lines and the last one has none.",
    aliases: ["List container", "Box"],
    props: [
      prop("label", "string", "Accessible name.", { required: true }),
      prop("maxHeight", '"none" | "small" | "medium" | "large"', "Scrolls past 160, 240 or 360 px.", {
        default: '"none"',
      }),
      prop("minHeight", '"none" | "list"', "Keeps room for a loading or empty state.", { default: '"none"' }),
      prop("children", "Snippet", "The rows.", { required: true }),
    ],
    examples: [
      {
        title: "Remotes",
        code: '<ListBox label="Remotes">{#each remotes as remote}<Text>{remote.name}</Text>{/each}</ListBox>',
      },
    ],
    replaces: [".commits in PushDialog.svelte", ".remotes in RemotesDialog.svelte"],
  },
  {
    name: "Pane",
    group: "Layout",
    summary: "A side column inside a view or dialog: a set width, its own scroll and a tinted background.",
    usage: "Use for a list beside its content, such as Local History's versions.",
    aliases: ["Side column", "Sidebar"],
    props: [
      prop("label", "string", "Accessible name.", { required: true }),
      prop("width", '"small" | "medium" | "large"', "140, 180 or 240 px.", { default: '"large"' }),
      prop("side", '"left" | "right"', "Where it sits; the line goes on the other side.", { default: '"left"' }),
      prop("line", '"strong" | "soft"', "Its edge line; soft for the welcome screen's sidebar.", {
        default: '"strong"',
      }),
      prop("children", "Snippet", "Its content.", { required: true }),
    ],
    examples: [{ title: "Versions", code: '<Pane label="Versions">...</Pane>' }],
    replaces: [".versions in src/lib/localHistory/LocalHistoryDialog.svelte"],
  },
];
