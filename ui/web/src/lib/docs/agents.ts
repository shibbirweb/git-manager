import { prop, type ComponentDoc } from "./types";

export const agentDocs: ComponentDoc[] = [
  {
    name: "FontSample",
    group: "Editor",
    summary: "A few lines of sample text in a chosen font, like Settings' editor and terminal previews.",
    usage: "Font, size, weight and spacing come from the user's settings, so they are data numbers here.",
    aliases: ["Font preview"],
    props: [
      prop("lines", "{ text; dim? }[]", "The sample's lines.", { required: true, data: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("variant", '"editor" | "terminal"', "Editor spacing, or the terminal's line height.", {
        default: '"editor"',
      }),
      prop("fontFamily", "string", "The font, from settings.", { data: true }),
      prop("fontSize", "number | null", "Its size in px, from settings.", { default: "null", data: true }),
      prop("fontWeight", "number | null", "Its weight, from settings.", { default: "null", data: true }),
      prop("letterSpacing", "number | null", "Extra spacing in px, from settings.", { default: "null", data: true }),
      prop("lineHeight", "number | null", "The terminal's line height, from settings.", {
        default: "null",
        data: true,
      }),
      prop("ligatures", "boolean", "Join ligatures.", { default: "true" }),
    ],
    examples: [{ title: "Editor", code: '<FontSample label="Preview" lines={sample} fontFamily="JetBrains Mono" />' }],
    replaces: [".font-preview and .terminal-preview in SettingsDialog.svelte"],
  },
  {
    name: "BulletList",
    group: "Feedback",
    summary: "A short bulleted list of facts, such as the settings changed from their defaults.",
    usage: "Render each item in `item`; an empty list shows `emptyText`.",
    aliases: ["List", "Bullets"],
    props: [
      prop("items", "T[]", "The items.", { required: true, data: true }),
      prop("label", "string", "Accessible name."),
      prop("emptyText", "string", "Shown when there are none.", { default: '""' }),
      prop("item", "Snippet<[T]>", "Draws one item.", { required: true }),
    ],
    examples: [
      {
        title: "Changed",
        code: '<BulletList items={keys} emptyText="Nothing yet">{#snippet item(key)}{key}{/snippet}</BulletList>',
      },
    ],
    replaces: [".changed in SettingsDialog.svelte"],
  },
];
