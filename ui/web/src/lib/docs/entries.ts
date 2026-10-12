import { prop, type ComponentDoc } from "./types";

const ACTION_TONE = '"neutral" | "success" | "danger" | "accent" | "warning"';

export const entryDocs: ComponentDoc[] = [
  {
    name: "ChoiceList",
    group: "Forms",
    summary: "A few answers to pick from, each a card with a label and a line of description.",
    usage: "Use in a dialog that asks how to do something. A danger choice has a red label.",
    aliases: ["Choices", "Option cards"],
    props: [
      prop("choices", "{ value; label; description?; danger? }[]", "The answers.", { required: true }),
      prop("label", "string", "Accessible name of the group.", { required: true }),
      prop("onpick", "(value: T) => void", "A choice was picked.", { required: true }),
    ],
    examples: [{ title: "Stash", code: '<ChoiceList label="Apply stash" {choices} onpick={apply} />' }],
    replaces: ['.choices in src/lib/ui/DialogHost.svelte ("choose" dialogs)'],
  },
  {
    name: "Link",
    group: "Actions",
    summary: "A button that looks like a link, for a small action in text or under a list.",
    usage: "accent for actions (Open settings); dim for a quiet disclosure (Show older releases).",
    aliases: ["Link", "Text button", "Anchor"],
    props: [
      prop("tone", '"accent" | "dim"', "Accent link or quiet text.", { default: '"accent"' }),
      prop("size", '"inherit" | "small"', "The surrounding text's size, or 12 px.", { default: '"inherit"' }),
      prop("mono", "boolean", "Code-like words, such as a parent commit's hash.", { default: "false" }),
      prop("icon", "IconName | null", "An icon before the words.", { default: "null" }),
      prop("disabled", "boolean", "Cannot be pressed.", { default: "false" }),
      prop("title", "string", "A tooltip."),
      prop("onclick", "(event: MouseEvent) => void", "Pressed."),
      prop("children", "Snippet", "The words.", { required: true }),
    ],
    examples: [{ title: "Settings", code: "<Link onclick={openSettings}>All settings</Link>" }],
    replaces: [".link in McpToolsDialog, GitHubSignInForm, Welcome, AiUsage", ".inline-link in SettingsDialog"],
  },
];
