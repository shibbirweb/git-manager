import { prop, type ComponentDoc } from "./types";

const TOOLBAR =
  '"tab" | "panel" | "editor" | "file" | "compact" | "log" | "filter" | "merge" | "footer" | "dialog" | "pane" | ' +
  '"head" | "popup" | "rail" | "conflict" | "strip" | "search" | "dialog-footer"';

export const barDocs: ComponentDoc[] = [
  {
    name: "Toolbar",
    group: "Layout",
    summary: "A row of controls along a view's edge: a tab's top bar, a panel's bar, the editors' bars, footers.",
    usage:
      "Pick the variant for the place: tab (git tabs, 34 px), panel (Git Console, Shelf), editor (diff), log, " +
      "filter (a search row), merge and footer (merge editor), dialog (a dialog's filter bar) or pane (a pane " +
      "inside a dialog). Put controls in `children` and what belongs at the far end in `end`.",
    aliases: ["Toolbar", "Button group", "Action bar", "Footer"],
    props: [
      prop("variant", TOOLBAR, "Where it sits: sets its height, padding, gap and edge line.", { default: '"tab"' }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("children", "Snippet", "Controls at the start.", { required: true }),
      prop("placement", '"top" | "bottom"', "Bottom: under its view, its line on top (File toolbar: Bottom).", {
        default: '"top"',
      }),
      prop("end", "Snippet", "Controls pushed to the far end."),
      prop("responsive", "boolean", "Measures its width, so Text, Badge and Divider inside can step aside with " +
        "`hideAt` or `dotAt` when it is narrow (the file bar).", { default: "false" }),
    ],
    examples: [
      {
        title: "A history tab",
        code:
          '<Toolbar label="File history">\n  <Icon name="history" size="normal" />\n' +
          "  <Text>History of cart.ts</Text>\n" +
          '  {#snippet end()}<Text tone="dim" size="small">12 commits</Text>{/snippet}\n</Toolbar>',
      },
    ],
    replaces: [
      ".toolbar in FileHistoryTab, LineHistoryTab, ReflogTab, BranchCompareTab, ChangesTab, WorktreeDiffTab",
      ".toolbar in GitConsoleView, ShelfPanel, DiffView, LogView, AiPanel, ScriptsPanel",
      ".toolbar and .footer in MergeEditor; .toolbar in McpToolsDialog, ShortcutsDialog, LocalHistoryDialog",
    ],
    logic: ["barSize.svelte.ts", "breakpoints.ts"],
    rules: [
      "Separate groups with a vertical Divider; it takes the toolbar's length and spacing.",
      "For narrow bars, set `responsive` and give the least needed words `hideAt`, never a width of your own.",
    ],
  },
  {
    name: "SectionTitle",
    group: "Layout",
    summary: "A small heading over a group of rows, with a count and buttons at its end.",
    usage:
      "Use over lists inside tabs, panels and dialogs. bar: a full bar with a line (Changes tab); list: inside a " +
      "tab; caption: quiet (commit details files); caps: small capitals (AI folders); day: dates (Local " +
      "History); divided: normal weight with a line (MCP groups).",
    aliases: ["Heading", "List header", "Group header"],
    props: [
      prop("title", "string", "The heading.", { required: true }),
      prop("titleMatches", "[number, number][]", "Ranges [start, end) of the title a search found, in the " +
        "warning tint (Settings search).", { default: "[]", data: true }),
      prop("variant", '"bar" | "list" | "caption" | "caps" | "day" | "divided" | "group" | "band" | "picker"',
        "The place it heads; band is a tinted strip.", {
        default: '"list"',
      }),
      prop("count", "number | null", "A count after the title.", { default: "null", data: true }),
      prop("heading", "2 | 3 | 4 | null", "Makes the title a heading of this level for screen readers.", {
        default: "null",
      }),
      prop("actions", "Snippet", "Buttons at the end."),
    ],
    examples: [{ title: "Changes", code: '<SectionTitle variant="bar" title="Staged" count={3} />' }],
    replaces: [
      ".section-title in BranchCompareTab, ChangesTab, WorktreeDiffTab",
      ".files-header in CommitDetails, .day in LocalHistoryDialog, .folder-heading in AiPanel",
      ".group-head in McpToolsDialog",
    ],
  },
  {
    name: "ToggleButton",
    group: "Actions",
    summary: "A button that stays on or off, such as Collapse unchanged in the diff or the merge editor's options.",
    usage:
      "Use plain in editor toolbars (borderless, tinted when on) and outline for options that stand out (merge " +
      "editor). Without `text` it is a narrow icon button named by `label`.",
    aliases: ["Toggle", "Pressed button"],
    props: [
      prop("pressed", "boolean", "On or off.", { default: "false", bindable: true }),
      prop("label", "string", "Accessible name, and the tooltip without `title`.", { required: true }),
      prop("text", "string", "Visible words.", { default: '""' }),
      prop("icon", "IconName | null", "An icon before the words.", { default: "null" }),
      prop("variant", '"plain" | "outline" | "tool" | "chip" | "filter"', "Borderless, outlined, a toolbar icon, " +
        "a chip, or a filter that turns accent when on.", { default: '"plain"' }),
      prop("disabled", "boolean", "Cannot be pressed.", { default: "false" }),
      prop("title", "string", "A longer tooltip."),
      prop("keepFocus", "boolean", "Pressing it leaves the focus where it was, such as in a search field.", {
        default: "false",
      }),
      prop("onchange", "(pressed: boolean) => void", "Called after each press."),
    ],
    examples: [{ title: "Diff", code: '<ToggleButton icon="list-tree" label="Collapse unchanged" bind:pressed />' }],
    replaces: ['<button class="toggle"> in DiffView.svelte and MergeEditor.svelte'],
  },
];
