import { prop, restProp, type ComponentDoc } from "./types";

const ICON_BUTTON_SIZE =
  '"large" | "normal" | "header" | "compact" | "small" | "chevron" | "inline" | "mini" | "micro" | "tool" | ' +
  '"row"';

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
      prop("variant", '"default" | "primary" | "danger" | "danger-primary" | "ghost"', "Look and weight; ghost " +
        "is borderless, like the header's pickers.", { default: '"default"' }),
      prop("size", '"normal" | "small" | "tiny" | "mini"', "Small is 24px (toolbars, rows); tiny 22px (media bars); " +
        "mini 20px (group headers).", {
        default: '"normal"',
      }),
      prop("pressed", "boolean | null", "A pressed choice (Fit, 100%): selected tint and aria-pressed.", {
        default: "null",
      }),
      prop("icon", `${ICON_NAME} | null`, "An icon before the text.", { default: "null" }),
      prop("badge", "number | null", "A count on the top right corner, such as options turned on.", {
        default: "null",
        data: true,
      }),
      prop("count", "number | null", "A dim count after the words, like the repository picker's.", {
        default: "null",
        data: true,
      }),
      prop("trailingIcon", `${ICON_NAME} | null`, "An icon after the text, such as a picker's chevron.", {
        default: "null",
      }),
      prop("type", '"button" | "submit" | "reset"', "The button's form type.", { default: '"button"' }),
      prop("keepFocus", "boolean", "Pressing it leaves the focus where it was, such as in a search field.", {
        default: "false",
      }),
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
      "Destructive actions confirm first (a message Dialog with a Danger primary button).",
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
      prop("iconSize", "IconSize", "A named icon size (see Icon).", { default: '"large"' }),
      prop("size", ICON_BUTTON_SIZE,
        "28px; large 30px (a sidebar's foot); header 26px (Back, Forward); compact 24px (panels); small " +
        "22px; chevron 24px and narrow (a menu half); inline 22px square (a list row's action); mini 20px " +
        "(a sidebar row's buttons); micro 18px (a list row's Remove); row 20px with a stronger hover " +
        "(repository rows); tool 24 by 22px, dim (file bar).", {
        default: '"normal"',
      }),
      prop("tone", '"default" | "dim" | "faint" | "dim-danger" | "success" | "danger"', "Dim or faint until " +
        "hovered (a message box's tools); dim-danger turns red when hovered (Drop); success or danger for Run " +
        "and Stop.", {
        default: '"default"',
      }),
      prop("active", "boolean", "Pressed look and aria-pressed, for toggles.", { default: "false" }),
      prop("spinning", "boolean", "The icon turns, such as Refresh while it runs.", { default: "false" }),
      prop("count", "string", "Short text after the icon, such as a repository row's sync counts.", {
        default: '""',
        data: true,
      }),
      prop("type", '"button" | "submit" | "reset"', "The button's form type.", { default: '"button"' }),
      prop("title", "string", "Tooltip when it should differ from `label`."),
      prop("keepFocus", "boolean", "Pressing it leaves the focus where it was, such as in a search field.", {
        default: "false",
      }),
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
      prop("variant", '"pill" | "joined" | "split"', "A tray with a raised choice; buttons joined in a box; or " +
        "equal parts filling the width.", { default: '"pill"' }),
      prop("size", '"normal" | "small"', "Small: narrow icon segments, like a file bar's view modes.", {
        default: '"normal"',
      }),
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
      prop("size", "IconSize", "A named size: xxsmall 9, xsmall 10, small 11, compact 12, medium 13, normal 14, " +
        "regular 15, large 16, xlarge 18, activity 19, xxlarge 20, emphasis 22, huge 24, logo 26, giant 28, " +
        "display 34 px.", { default: '"large"' }),
      prop("stroke", '"thin" | "light" | "normal" | "bold"',
        "Line weight 1.5, 1.8, 2 or 2.6: light for activity bars, thin for big empty-state art, bold for small " +
        "marks such as a check.", { default: '"normal"' }),
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
