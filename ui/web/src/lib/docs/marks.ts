import { prop, type ComponentDoc } from "./types";

export const markDocs: ComponentDoc[] = [
  {
    name: "StatusDot",
    group: "Feedback",
    summary: "A small round dot that tells a state: a command's result, a server on or off, a run going on.",
    usage: "Use before a row or label. `pulse` while something runs; `small` in a status bar button.",
    aliases: ["Dot", "Indicator", "Status"],
    props: [
      prop("tone", '"neutral" | "success" | "danger" | "warning" | "accent"', "The state's color.", {
        default: '"neutral"',
      }),
      prop("pulse", "boolean", "Fades in and out while something runs.", { default: "false" }),
      prop("size", '"normal" | "small"', "8 or 6 px.", { default: '"normal"' }),
      prop("label", "string", "Read by screen readers and shown as a tooltip."),
    ],
    examples: [{ title: "A running command", code: '<StatusDot tone="neutral" pulse label="Running" />' }],
    replaces: [".status in GitConsoleView", ".dot in McpToolsDialog", ".dot in KeepAwake"],
  },
  {
    name: "Avatar",
    group: "Feedback",
    summary: "Initials in a round accent circle (an account) or a rounded tile in a palette color (a project).",
    usage: "Use circle for a signed-in account and tile for projects; give the same name the same color.",
    aliases: ["Avatar", "Initials"],
    props: [
      prop("text", "string", "One or two letters.", { required: true }),
      prop("shape", '"circle" | "tile"', "32 px circle or 36 px tile.", { default: '"circle"' }),
      prop("color", '"accent" | "blue" | "green" | "magenta" | "cyan" | "red"', "The fill.", {
        default: '"accent"',
      }),
      prop("label", "string", "Read by screen readers, such as the full name."),
    ],
    examples: [{ title: "A project", code: '<Avatar text="SF" shape="tile" color="cyan" />' }],
    replaces: [".avatar in GitHubSignInForm", ".badge-* project tiles in Welcome"],
  },
  {
    name: "Chip",
    group: "Actions",
    summary: "A small rounded button with a word or two: a filter summary or a value to pick.",
    usage: "filter: sums up and filters a list (AI panel). pick: offers a value, such as a font in its own face.",
    aliases: ["Chip", "Filter pill"],
    props: [
      prop("text", "string", "The words.", { required: true, data: true }),
      prop("variant", '"filter" | "pick" | "badge"', "A filter, a value to pick, or a small bordered fact.", {
        default: '"filter"',
      }),
      prop("tone", '"neutral" | "warning"', "Warning for something waiting on you.", { default: '"neutral"' }),
      prop("icon", "IconName | null", "An icon before the words.", { default: "null" }),
      prop("status", '"starting" | "working" | "waiting" | "done" | "exited" | "idle" | null', "A status mark before " +
        "the words in place of `icon`, such as the AI panel's 2 need you.", { default: "null" }),
      prop("fontFamily", "string", "Shows the words in this font (font picks); data, not design.", { data: true }),
      prop("title", "string", "A tooltip."),
      prop("onclick", "() => void", "Makes it a button."),
    ],
    examples: [
      { title: "Font pick", code: '<Chip variant="pick" text="JetBrains Mono" fontFamily="JetBrains Mono" />' },
    ],
    replaces: [".pill in AiPanel", ".font-pick in SettingsDialog"],
  },
  {
    name: "Pill",
    group: "Feedback",
    summary: "A rounded word that tells a state: unsaved, modified, merging, write.",
    usage: "Use next to a name. `strong` for an operation in progress (a repository that is merging).",
    aliases: ["Status badge", "Label"],
    props: [
      prop("tone", '"neutral" | "accent" | "success" | "warning" | "danger" | "selected"', "The tint; selected " +
        "reads on a selected row.", { default: '"neutral"' }),
      prop("strong", "boolean", "Bold words.", { default: "false" }),
      prop("variant", '"fill" | "outline" | "border"', "Outline: a small bordered flag, such as a setting's memory " +
        "cost; border: a fill with a border.", {
        default: '"fill"',
      }),
      prop("title", "string", "A tooltip."),
      prop("dotAt", '"tiny" | "narrow" | "compact" | "medium" | null', "In a responsive Toolbar or Stack under 220, " +
        "320, 480 or 600 px, only a dot in its color shows; the word stays in its name (the file bar).", {
        default: "null",
      }),
      prop("children", "Snippet", "The word.", { required: true }),
    ],
    examples: [
      { title: "Unsaved", code: '<Pill tone="warning">Unsaved</Pill>' },
      { title: "File bar", code: '<Pill tone="accent" title="Modified" dotAt="compact">Modified</Pill>' },
    ],
    replaces: [".badge in FileView, McpToolsDialog, ColorThemePicker", ".op-badge in RepoSection, CleanRepoList"],
  },
  {
    name: "Mark",
    group: "Feedback",
    summary: "A tiny box with one to three letters that names a tool, such as an AI agent.",
    usage: "Use before an agent's row (normal) or its usage in the status bar (small).",
    aliases: ["Agent mark", "Monogram"],
    props: [
      prop("text", "string", "The letters.", { required: true, data: true }),
      prop("size", '"normal" | "small"', "Row or status bar size.", { default: '"normal"' }),
      prop("title", "string", "The tool's full name."),
    ],
    examples: [{ title: "Claude Code", code: '<Mark text="CC" title="Claude Code" />' }],
    replaces: [".badge in AiPanel agent rows", ".mark in AiUsage"],
  },
  {
    name: "Meter",
    group: "Feedback",
    summary: "How much of something is used: a label and value over a bar.",
    usage: "memory: memory details; usage: AI usage windows (warning and danger tones); mini: a bar in a status item.",
    aliases: ["Meter", "Usage bar", "Gauge"],
    props: [
      prop("fraction", "number", "0 to 1.", { required: true, data: true }),
      prop("label", "string", "What is measured.", { default: '""' }),
      prop("value", "string", "The amount, on the right.", { default: '""' }),
      prop("detail", "string", "A small line under the bar, such as when it resets.", { default: '""' }),
      prop("variant", '"memory" | "usage" | "mini"', "The bar's size and track.", { default: '"memory"' }),
      prop("tone", '"accent" | "warning" | "danger"', "The fill's color.", { default: '"accent"' }),
      prop("title", "string", "A tooltip, such as a process's name and id."),
    ],
    examples: [{ title: "Memory", code: '<Meter label="Web content" value="181 MB" fraction={0.45} />' }],
    replaces: [".process and .bar in StatusBar memory details", ".window, .wide-bar and .bar in AiUsage"],
  },
  {
    name: "ZoomBadge",
    group: "Feedback",
    summary: "A floating badge at the top of the window that shows a value for a moment, such as the zoom level.",
    usage: "Show it after the value changes and hide it after a second.",
    aliases: ["Zoom", "HUD"],
    props: [
      prop("open", "boolean", "Shown or hidden.", { default: "true" }),
      prop("text", "string", "The value, such as 110%.", { required: true, data: true }),
    ],
    examples: [{ title: "Zoom", code: '<ZoomBadge open={zoomShown} text="110%" />' }],
    replaces: [".zoom-badge in App.svelte"],
  },
];
