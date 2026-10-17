import { prop, type ComponentDoc } from "./types";

const PALETTE = '"blue" | "green" | "magenta" | "cyan" | "red"';

export const welcomeDocs: ComponentDoc[] = [
  {
    name: "Logo",
    group: "Feedback",
    summary: "The app's logo: the merge mark on an accent tile.",
    usage: "Use in the Welcome page's brand (normal) and greeting and in About (large).",
    aliases: ["Brand", "App icon"],
    props: [
      prop("size", '"normal" | "medium" | "large" | "soft"', "40, 48 (About) or 72 px, or a 56 px tinted tile.", {
        default: '"normal"',
      }),
      prop("label", "string", "Read by screen readers.", { default: '"Nibtree"' }),
    ],
    examples: [{ title: "Greeting", code: '<Logo size="large" />' }],
    replaces: [".logo in Welcome.svelte", ".about-logo in SettingsDialog.svelte"],
  },
  {
    name: "Tile",
    group: "Actions",
    summary: "A big start action: its icon on a rounded tile and its name under it.",
    usage: "Use for the Welcome page's Open, Clone and New. The tile turns accent on hover and focus.",
    aliases: ["Start action", "Big button"],
    props: [
      prop("icon", "IconName", "The action's icon.", { required: true }),
      prop("label", "string", "The action's name.", { required: true }),
      prop("title", "string", "A tooltip."),
      prop("onclick", "() => void", "Pressed.", { required: true }),
    ],
    examples: [{ title: "Open", code: '<Tile icon="folder" label="Open" onclick={open} />' }],
    replaces: [".tile in Welcome.svelte"],
  },
  {
    name: "ResourceLink",
    group: "Navigation",
    summary: "A large row that opens something to read or do: icon, title and a line of description.",
    usage: "Use for the Welcome page's Learn links.",
    aliases: ["Link card", "Learn"],
    props: [
      prop("icon", "IconName", "The resource's icon.", { required: true }),
      prop("title", "string", "Its name.", { required: true }),
      prop("description", "string", "One line about it.", { default: '""' }),
      prop("variant", '"plain" | "card"', "Plain (Welcome) or a bordered card (Settings' About).", {
        default: '"plain"',
      }),
      prop("onclick", "() => void", "Pressed.", { required: true }),
    ],
    examples: [{ title: "Docs", code: '<ResourceLink icon="book" title="Documentation" onclick={openWiki} />' }],
    replaces: [".learn-item in Welcome.svelte"],
  },
];
