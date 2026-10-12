import { prop, type ComponentDoc } from "./types";

export const contentDocs: ComponentDoc[] = [
  {
    name: "DescriptionList",
    group: "Layout",
    summary: "Label and value pairs in two columns, like a commit's Author, Date and Parents.",
    usage: "Use for facts about one thing. Mark hashes and paths `mono`; draw links with the `value` snippet.",
    props: [
      prop("items", "{ label: string; value: string; mono?: boolean }[]", "The pairs.", { required: true }),
      prop("label", "string", "Accessible name."),
      prop("value", "Snippet<[DescriptionItem]>", "Draws a value instead of its text."),
    ],
    examples: [{ title: "Commit", code: '<DescriptionList items={[{ label: "Author", value: author }]} />' }],
    replaces: ['<dl class="meta"> in CommitDetails.svelte'],
  },
  {
    name: "CodeBlock",
    group: "Editor",
    summary: "Plain monospace text without an editor: command output, a command to run, or error details.",
    usage: "Use for read-only text that needs no highlighting. Use CodeView for highlighted code.",
    aliases: ["Pre", "Output"],
    props: [
      prop("text", "string", "The text.", { required: true }),
      prop("variant", '"output" | "command" | "detail" | "preview" | "prompt"',
        "Console output, a dialog's git command, error details, a file's text before it is used (a gist), or " +
        "an agent's prompt.", {
        default: '"output"',
      }),
      prop("maxHeight", '"none" | "small" | "medium" | "large"', "Scroll beyond 200, 360 or 520 px.", {
        default: '"none"',
      }),
      prop("label", "string", "Accessible name."),
    ],
    examples: [{ title: "Command", code: '<CodeBlock variant="command" text="git pull --rebase origin main" />' }],
    replaces: ['<pre class="block"> in GitConsoleView', '<div class="command"> in Git dialogs', "toast details"],
  },
  {
    name: "HighlightText",
    group: "Editor",
    summary: "Text with its matched characters shown, in bold accent or with a tinted background.",
    usage: "Use for search and quick open results. Ranges are [start, end) character offsets.",
    aliases: ["Highlight", "Mark"],
    props: [
      prop("text", "string", "The text.", { required: true }),
      prop("ranges", "[number, number][]", "Matched ranges.", { required: true, data: true }),
      prop("variant", '"strong" | "mark"', "Bold accent (quick open) or a tinted background (search).", {
        default: '"strong"',
      }),
    ],
    examples: [{ title: "Quick open", code: '<HighlightText text={path} ranges={match.ranges} />' }],
    logic: ["highlight.ts"],
    replaces: ["<b> in QuickOpen and RecentFiles", "<mark> in TextResult"],
  },
  {
    name: "Fieldset",
    group: "Forms",
    summary: "A group of options under a legend, like Pull's choices of how to integrate changes.",
    usage: "Use around a RadioGroup or Checkboxes that answer one question in a dialog.",
    props: [
      prop("legend", "string", "The question.", { required: true }),
      prop("disabled", "boolean", "Disables every option inside.", { default: "false" }),
      prop("legendTone", '"faint" | "dim"', "Faint in dialogs; dim in a small form like Commit Options.", {
        default: '"faint"',
      }),
      prop("children", "Snippet", "The options.", { required: true }),
    ],
    examples: [
      { title: "Pull", code: '<Fieldset legend="Integrate with">\n  <RadioGroup ... layout="columns" />\n</Fieldset>' },
    ],
    replaces: ['<fieldset class="modes"><legend class="hint"> in Pull, Reset, Update Project and more'],
  },
  {
    name: "SideNav",
    group: "Navigation",
    summary: "A vertical list of sections with the open one marked, like the Settings sections.",
    usage: "Use beside a page of sections. A `danger` item (such as Reset) shows in red.",
    aliases: ["Sidebar navigation"],
    props: [
      prop("items", "{ id: string; label: string; icon?: IconName; danger?: boolean }[]", "The sections.", {
        required: true,
      }),
      prop("variant", '"settings" | "large" | "links"', "Settings' sections, the Welcome page's (36px), or dim " +
        "links with icons.", { default: '"settings"' }),
      prop("active", "string | null", "The open section's id.", { default: "null", bindable: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("emptyText", "string", "Shown when there are no items (a search found no section).", { default: '""' }),
      prop("onselect", "(id: string) => void", "A section was picked."),
    ],
    examples: [{ title: "Settings", code: '<SideNav label="Settings sections" {items} bind:active />' }],
    replaces: ['<button class="nav-item"> in SettingsDialog'],
  },
  {
    name: "SplitButton",
    group: "Actions",
    summary: "A main action joined to a menu of related actions, like Commit with Commit and Push.",
    usage: "Use when one action is the usual choice and a few close variants exist.",
    aliases: ["Button group"],
    props: [
      prop("text", "string", "The main action.", { required: true }),
      prop("items", "MenuItem[]", "The related actions.", { required: true }),
      prop("menuLabel", "string", "The arrow's accessible name.", { required: true }),
      prop("variant", '"default" | "primary"', "Weight.", { default: '"primary"' }),
      prop("size", '"normal" | "small"', "Height.", { default: '"normal"' }),
      prop("icon", "IconName | null", "An icon before the text.", { default: "null" }),
      prop("disabled", "boolean", "Disables both parts.", { default: "false" }),
      prop("onclick", "() => void", "The main action.", { required: true }),
    ],
    examples: [{ title: "Commit", code: '<SplitButton text="Commit" menuLabel="More" {items} onclick={commit} />' }],
    logic: ["menuModel.ts"],
    replaces: ['<span class="split"> in CommitBox.svelte'],
  },
  {
    name: "LoadingOverlay",
    group: "Overlays",
    summary: "A card over a dimmed window while something long happens: spinner, title, step and hint.",
    usage: "Use only for work that blocks the window, such as opening a big folder. Otherwise use Spinner.",
    props: [
      prop("open", "boolean", "Shown or hidden.", { default: "true" }),
      prop("title", "string", "What is happening.", { required: true }),
      prop("step", "string", "The current step.", { default: '""' }),
      prop("hint", "string", "A faint note.", { default: '""' }),
    ],
    examples: [{ title: "Opening", code: '<LoadingOverlay title="Opening storefront" step="Reading repositories" />' }],
    replaces: ["src/lib/views/OpeningProgress.svelte"],
  },
  {
    name: "ThemeSwatch",
    group: "Feedback",
    summary: "A color theme's preview chip: code on its background and bars of its main colors.",
    usage: "Use in theme lists. The colors are the theme's own, so they come in as data.",
    props: [
      prop(
        "colors",
        "{ background; foreground; border; keyword; string; accent; selection: string }",
        "The theme's colors.",
        { required: true, data: true },
      ),
      prop("label", "string", "The theme's name.", { required: true }),
    ],
    examples: [{ title: "Theme", code: '<ThemeSwatch label="Monokai" colors={theme.swatch} />' }],
    replaces: ['<span class="swatch"> in ColorThemePicker.svelte'],
  },
];
