import { prop, type ComponentDoc } from "./types";

export const feedbackDocs: ComponentDoc[] = [
  {
    name: "Spinner",
    group: "Feedback",
    summary: "A small spinning ring for work in progress.",
    usage: "Use beside a label while something loads or runs. Use ProgressBar when the share done is known.",
    aliases: ["Spinner", "Loader"],
    props: [
      prop("label", "string", "What is loading, read by screen readers.", { default: '"Loading"' }),
      prop("size", '"normal" | "large"', "Normal is 12px; large is twice that, for empty panels.", {
        default: '"normal"',
      }),
    ],
    examples: [{ title: "Loading", code: '<Spinner label="Loading the log" />' }],
    replaces: ['<span class="spinner"></span>'],
  },
  {
    name: "Badge",
    group: "Feedback",
    summary: 'A count in a small pill, like the changes count on the activity bar; "99+" above `max`.',
    usage: "Use for counts on buttons and tabs. Use Tag for words.",
    aliases: ["Badge", "Counter"],
    props: [
      prop("count", "number", "The number.", { required: true }),
      prop("max", "number", "Above it, shows `max+`.", { default: "99" }),
      prop("tone", '"accent" | "danger" | "neutral"', "Color: accent for counts, danger for conflicts.", {
        default: '"accent"',
      }),
      prop("label", "string", "What the count means, e.g. `3 changes`; defaults to the number."),
    ],
    examples: [{ title: "Changes", code: '<Badge count={changes} label="{changes} changes" />' }],
    replaces: ['<span class="badge">3</span>'],
  },
  {
    name: "Tag",
    group: "Feedback",
    summary: 'A small label beside a name, like "primary" or "folder" in the AI panel.',
    usage: "Use for a word of status next to a name. Use Badge for numbers.",
    aliases: ["Tag", "Chip", "Label"],
    props: [
      prop("tone", '"neutral" | "accent" | "danger" | "success" | "warning"', "Color of the label.", {
        default: '"neutral"',
      }),
      prop("title", "string", "Tooltip."),
      prop("children", "Snippet", "The word.", { required: true }),
    ],
    examples: [{ title: "Main worktree", code: "<Tag>primary</Tag>" }],
    replaces: ['<span class="tag">primary</span>', '<span class="pill">'],
  },
  {
    name: "Kbd",
    group: "Feedback",
    summary: "A keyboard shortcut drawn as a key cap.",
    usage: "Use in shortcut lists and empty states. Pass text from commandKeys(id) or localKeys(...).",
    aliases: ["Kbd", "Shortcut"],
    props: [prop("keys", "string", "The shortcut text, e.g. from commandKeys(\"quickOpen\").", { required: true })],
    examples: [{ title: "Shortcut", code: '<Kbd keys={commandKeys("quickOpen")} />' }],
    replaces: ["<kbd>...</kbd> in the Keyboard Shortcuts dialog and the empty editor"],
    rules: ["Never type a shortcut by hand: Windows shows Ctrl, and users can change keys."],
  },
  {
    name: "ProgressBar",
    group: "Feedback",
    summary: "A thin bar for a share of a whole, like each process's memory in the status bar details.",
    usage: "Use when the share is known (0 to 1). Use Spinner while the amount is unknown.",
    aliases: ["Progress"],
    props: [
      prop("value", "number", "The share, 0 to 1; out-of-range and NaN values are clamped.", { required: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("tone", '"accent" | "danger" | "warning" | "success"', "Fill color.", { default: '"accent"' }),
      prop("minimum", "number", "Smallest drawn share, so tiny values stay visible.", { default: "0.02" }),
    ],
    examples: [{ title: "Memory share", code: '<ProgressBar value={bytes / total} label="Web content memory" />' }],
    replaces: ['<div class="bar"><div class="fill" style="width: ..."></div></div>'],
  },
  {
    name: "Notice",
    group: "Feedback",
    summary: "A tinted banner with an icon, a message and an optional action on the right.",
    usage:
      "Use inside a view for a state the user should know, such as a file changed on disk. Use a toast for events.",
    aliases: ["Alert", "Banner", "Callout"],
    props: [
      prop("tone", '"danger" | "warning" | "info" | "success"', "Color and default icon.", { default: '"info"' }),
      prop("icon", "IconName | null", "Another icon than the tone's.", { default: "null" }),
      prop("action", "Snippet", "A button on the right."),
      prop("children", "Snippet", "The message.", { required: true }),
    ],
    examples: [
      {
        title: "With an action",
        code:
          '<Notice tone="danger">\n  The file changed on disk.\n' +
          '  {#snippet action()}<Button size="small" onclick={reload}>Reload</Button>{/snippet}\n</Notice>',
      },
    ],
    replaces: ['<div class="notice"><Icon name="alert" /><span>...</span></div>'],
  },
  {
    name: "EmptyState",
    group: "Feedback",
    summary: "The centered message of an empty panel or tab, with an optional icon, hint and action.",
    usage: "Use when a list or view has nothing to show. Say what the user can do next in `hint`.",
    aliases: ["Empty"],
    props: [
      prop("title", "string", "What is empty.", { required: true }),
      prop("hint", "string", "What to do next.", { default: '""' }),
      prop("icon", "IconName | null", "An icon above the title.", { default: "null" }),
      prop("action", "Snippet", "A button under the text."),
    ],
    examples: [
      {
        title: "No stashes",
        code: '<EmptyState icon="stash" title="No stashes" hint="Stash changes to set them aside." />',
      },
    ],
    replaces: ['<div class="placeholder">...</div>', '<div class="empty">...</div>'],
  },
];
