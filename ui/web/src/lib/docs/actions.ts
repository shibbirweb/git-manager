import { prop, restProp, type ComponentDoc } from "./types";

export const ICON_NAME = "IconName";

export const actionDocs: ComponentDoc[] = [
  {
    name: "Button",
    group: "Actions",
    summary:
      "A text button: Default, Primary for the main action, Danger, or Danger primary for a destructive confirm.",
    usage:
      "Use for dialog actions and commands with a word on them. One Primary button per dialog or form. " +
      "Use IconButton for icon-only commands in toolbars and rows.",
    aliases: ["Button"],
    props: [
      prop("variant", '"default" | "primary" | "danger" | "danger-primary"', "Look and weight.", {
        default: '"default"',
      }),
      prop("size", '"normal" | "small"', "Small is 24px high, for toolbars and rows.", { default: '"normal"' }),
      prop("icon", `${ICON_NAME} | null`, "An icon before the text.", { default: "null" }),
      prop("type", '"button" | "submit" | "reset"', "The button's form type.", { default: '"button"' }),
      prop("element", "HTMLButtonElement | null", "The button element, to focus it.", {
        default: "null",
        bindable: true,
      }),
      prop("children", "Snippet", "The text."),
      restProp("HTMLButton", "onclick, disabled, title, aria-*"),
    ],
    examples: [
      {
        title: "Dialog actions",
        code: '<Button onclick={cancel}>Cancel</Button>\n<Button variant="primary" onclick={save}>Save</Button>',
      },
      {
        title: "Destructive confirm",
        code: '<Button variant="danger-primary" onclick={remove}>Delete Branch</Button>',
      },
    ],
    replaces: [
      '<button class="btn">',
      '<button class="btn primary">',
      '<button class="btn danger">',
      '<button class="btn small">',
      '<button class="btn primary danger-fill">',
    ],
    rules: [
      "Keep labels short and plain; never type a shortcut into a label (use commandKeys in the tooltip).",
      "Destructive actions confirm first (ConfirmDialog with danger).",
    ],
  },
  {
    name: "IconButton",
    group: "Actions",
    summary: "A borderless icon button, optionally with text after the icon; `label` is its name and tooltip.",
    usage: "Use in toolbars, panel headers, rows and tab strips. Use Button when the command needs a word.",
    aliases: ["Toggle"],
    props: [
      prop("icon", ICON_NAME, "The icon.", { required: true }),
      prop("label", "string", "Accessible name; also the tooltip unless `title` is given.", { required: true }),
      prop("iconSize", "number", "Icon size in px.", { default: "16" }),
      prop("size", '"normal" | "small"', "Small is 22px, for close buttons in rows and tabs.", {
        default: '"normal"',
      }),
      prop("active", "boolean", "Pressed look and aria-pressed, for toggles.", { default: "false" }),
      prop("type", '"button" | "submit" | "reset"', "The button's form type.", { default: '"button"' }),
      prop("title", "string", "Tooltip when it should differ from `label`."),
      prop("element", "HTMLButtonElement | null", "The button element.", { default: "null", bindable: true }),
      prop("children", "Snippet", "Optional text after the icon."),
      restProp("HTMLButton", "onclick, disabled, aria-*"),
    ],
    examples: [
      { title: "Toolbar", code: '<IconButton icon="refresh" label="Refresh" onclick={refresh} />' },
      { title: "Toggle", code: '<IconButton icon="pin" label="Pin" active={pinned} onclick={togglePin} />' },
    ],
    replaces: ['<button class="icon-btn" title="..." aria-label="...">'],
    rules: ["Always give a `label`; an icon alone has no name for screen readers."],
  },
  {
    name: "Segmented",
    group: "Actions",
    summary: "A row of mutually exclusive choices (a toggle group), like Light / Dark / System. Arrow keys move.",
    usage:
      "Use for two to four short choices that apply at once. Use Select for longer lists and RadioGroup when " +
      "each choice needs a description.",
    aliases: ["Toggle group", "Segmented control"],
    props: [
      prop(
        "options",
        "{ value: T; label?: string; icon?: IconName; title?: string; disabled?: boolean }[]",
        "The choices; give `title` to icon-only ones.",
        { required: true },
      ),
      prop("value", "T extends string", "The chosen value.", { required: true, bindable: true }),
      prop("label", "string", "Accessible name of the group.", { required: true }),
      prop("disabled", "boolean", "Disables every choice.", { default: "false" }),
      prop("onchange", "(value: T) => void", "Called when the user picks another choice."),
    ],
    examples: [
      {
        title: "A setting",
        code:
          '<Segmented\n  label="Theme"\n  bind:value={theme}\n  options={[\n    { value: "light", label: "Light" },\n' +
          '    { value: "dark", label: "Dark" },\n  ]}\n/>',
      },
    ],
    logic: ["roving.ts"],
    replaces: ['<div class="segmented"><button class:on={...}>', "Settings choices such as theme and diff layout"],
  },
  {
    name: "Icon",
    group: "Actions",
    summary: "A stroke icon on a 24px grid in the current text color. The preview lists every icon name.",
    usage: "Use inside buttons, rows and labels. Color it with `tone`; never hard-code a color.",
    props: [
      prop("name", ICON_NAME, "Which icon; the preview lists them all.", { required: true }),
      prop("size", "number", "Width and height in px.", { default: "16" }),
      prop("strokeWidth", "number", "Line width on the 24px grid.", { default: "2" }),
      prop(
        "tone",
        '"inherit" | "default" | "dim" | "faint" | "accent" | "danger" | "success" | "warning"',
        "Color from the theme; inherit takes the parent's text color.",
        { default: '"inherit"' },
      ),
    ],
    examples: [{ title: "In a label", code: '<span class="row"><Icon name="branch" size={14} /> main</span>' }],
    replaces: ['<Icon name="..." /> from src/lib/ui/Icon.svelte (same props)'],
  },
];
