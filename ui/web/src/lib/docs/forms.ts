import { prop, restProp, type ComponentDoc } from "./types";

const OPTION_VALUE = "T extends string";
const LABEL_COLUMN = '"small" | "medium" | "large"';

export const formDocs: ComponentDoc[] = [
  {
    name: "Input",
    group: "Forms",
    summary: "A single-line text field. `invalid` draws a red border; Field shows the message under it.",
    usage: "Use for names, paths and filters. Wrap it in Field for a label, hint or error. Use SearchField to filter.",
    aliases: ["Input", "Text field"],
    props: [
      prop("value", "string", "The text.", { default: '""', bindable: true }),
      prop("invalid", "boolean", "Red border and aria-invalid.", { default: "false" }),
      prop("mono", "boolean", "Monospace text, for hashes and paths.", { default: "false" }),
      prop("type", "string", "The input type.", { default: '"text"' }),
      prop("width", '"auto" | "fill" | "xsmall" | "small" | "medium" | "large"', "auto, the parent's width, or " +
        "80, 120, 180 or 280 px.", { default: '"auto"' }),
      prop("suggestions", "string[]", "Values offered while typing, such as installed font names.", { default: "[]" }),
      prop("element", "HTMLInputElement | null", "The input element, to focus or select it.", {
        default: "null",
        bindable: true,
      }),
      restProp("HTMLInput", "placeholder, disabled, readonly, aria-label, oninput, onkeydown"),
    ],
    examples: [
      { title: "Branch name", code: '<Input bind:value={name} placeholder="Branch name" aria-label="Branch name" />' },
    ],
    replaces: ['<input class="input" ...>'],
    rules: ["Give it a visible label (Field) or an aria-label."],
  },
  {
    name: "TextArea",
    group: "Forms",
    summary: "A multi-line text field, like the commit message box.",
    usage: "Use for commit messages, tag messages and notes.",
    aliases: ["Textarea"],
    props: [
      prop("value", "string", "The text.", { default: '""', bindable: true }),
      prop("rows", '"small" | "normal" | "large" | "xlarge"', "Visible lines: 2, 3, 5 or 8.", { default: '"normal"' }),
      prop("height", '"rows" | "short" | "tall"', "Its height from `rows`, or a set height: short 56 px (a " +
        "repository's own commit box), tall 96 px (the commit message).", { default: '"rows"' }),
      prop("resize", '"none" | "vertical"', "Whether the user can drag its height.", { default: '"none"' }),
      prop("invalid", "boolean", "Red border and aria-invalid.", { default: "false" }),
      prop("mono", "boolean", "Monospace text.", { default: "false" }),
      prop("element", "HTMLTextAreaElement | null", "The textarea element.", { default: "null", bindable: true }),
      prop("tools", "Snippet", "Small buttons in its top right corner (IconButton size small, tone dim), such as " +
        "Message History; the text keeps clear of them."),
      restProp("HTMLTextarea", "placeholder, disabled, aria-label, onkeydown"),
    ],
    examples: [
      { title: "Commit message", code: '<TextArea bind:value={message} rows="large" placeholder="Commit message" />' },
      {
        title: "With tools in the corner",
        code:
          '<TextArea bind:value={message} height="tall" aria-label="Commit message">\n  {#snippet tools()}\n' +
          '    <IconButton icon="history" label="Message History" size="small" tone="dim" iconSize="medium" />\n' +
          "  {/snippet}\n</TextArea>",
      },
    ],
    replaces: ['<textarea class="input" ...>', '<div class="message-wrap"> and .message-tools in CommitBox.svelte'],
  },
  {
    name: "Select",
    group: "Forms",
    summary: "A native drop-down list, styled like Input.",
    usage: "Use for five or more choices, or long labels. Use Segmented for two to four short choices.",
    aliases: ["Select", "Native select"],
    props: [
      prop("options", `{ value: ${OPTION_VALUE}; label: string; disabled?: boolean; title?: string }[]`, "The " +
        "choices; `title` is a tooltip for one, such as what a rebase action does.", { required: true }),
      prop("value", OPTION_VALUE, "The chosen value.", { required: true, bindable: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("disabled", "boolean", "Disables it.", { default: "false" }),
      prop("size", '"normal" | "small"', "Small: 24px, inside a settings line.", { default: '"normal"' }),
      prop("width", '"auto" | "fill" | "xsmall" | "small" | "medium" | "large"', "auto, the parent's width, or " +
        "80, 120, 180 or 280 px.", { default: '"auto"' }),
      prop("title", "string", "Tooltip, such as the chosen repository's full path."),
      prop("onchange", "(value: T) => void", "Called with the new value."),
    ],
    examples: [
      {
        title: "Cursor style",
        code: '<Select label="Cursor style" bind:value={cursor} options={[{ value: "bar", label: "Bar" }]} />',
      },
    ],
    replaces: ['<select class="input select">'],
  },
  {
    name: "Checkbox",
    group: "Forms",
    summary: "A native checkbox with its label; clicking the text toggles it too.",
    usage: "Use for options inside a dialog or list. Use Switch for settings that apply at once.",
    aliases: ["Checkbox"],
    props: [
      prop("checked", "boolean", "Whether it is ticked.", { default: "false", bindable: true }),
      prop("indeterminate", "boolean", "The mixed state, for a select-all box.", { default: "false" }),
      prop("label", "string", "The text, when `children` is not given.", { default: '""' }),
      prop("disabled", "boolean", "Disables it.", { default: "false" }),
      prop("size", '"normal" | "small"', "Small: 12px dim words, for an option in a bar.", { default: '"normal"' }),
      prop("title", "string", "Tooltip, such as why it is off."),
      prop("onchange", "(checked: boolean) => void", "Called with the new state."),
      prop("children", "Snippet", "Rich label content instead of `label`."),
    ],
    examples: [{ title: "Commit option", code: '<Checkbox label="Sign off" bind:checked={signOff} />' }],
    replaces: ['<label class="check"><input type="checkbox" /> Text</label>'],
  },
  {
    name: "RadioGroup",
    group: "Forms",
    summary: "Native radio buttons for one choice among a few, each with an optional description.",
    usage: "Use when each choice needs a sentence. Use Segmented for short labels without descriptions.",
    aliases: ["Radio group"],
    props: [
      prop(
        "options",
        `{ value: ${OPTION_VALUE}; label: string; description?: string; disabled?: boolean; danger?: boolean }[]`,
        "The choices.",
        { required: true },
      ),
      prop("value", OPTION_VALUE, "The chosen value.", { required: true, bindable: true }),
      prop("name", "string", "The radio group's form name; unique on the page.", { required: true }),
      prop("label", "string", "Accessible name of the group.", { required: true }),
      prop("labelWidth", LABEL_COLUMN, "The label column in columns layout: 100, 120 or 130 px.", {
        default: '"large"',
      }),
      prop("direction", '"column" | "row"', "Stack or line up the choices.", { default: '"column"' }),
      prop("layout", '"stacked" | "columns"', "Description under the label, or label and description in columns " +
        "(Pull's modes).", { default: '"stacked"' }),
      prop("onchange", "(value: T) => void", "Called with the new value."),
    ],
    examples: [
      {
        title: "Identity scope",
        code: '<RadioGroup label="Scope" name="scope" bind:value={scope} options={scopes} />',
      },
    ],
    replaces: ['<label><input type="radio" name="..." bind:group={...} /> ...</label>'],
  },
  {
    name: "Switch",
    group: "Forms",
    summary: "An on/off switch for a setting that applies at once.",
    usage: "Use in Settings rows and panels. Use Checkbox inside dialogs whose changes apply on OK.",
    aliases: ["Switch", "Toggle switch"],
    props: [
      prop("checked", "boolean", "On or off.", { default: "false", bindable: true }),
      prop("label", "string", "Accessible name, usually the setting's title.", { required: true }),
      prop("disabled", "boolean", "Disables it.", { default: "false" }),
      prop("onchange", "(checked: boolean) => void", "Called with the new state."),
    ],
    examples: [{ title: "Setting", code: '<Switch label="Word wrap" bind:checked={wrap} />' }],
    replaces: ['<input type="checkbox" class="switch" />'],
  },
  {
    name: "Slider",
    group: "Forms",
    summary: "A range slider with its value on the right, like Settings' font size.",
    usage: "Use for a number in a known range where the exact value matters less than the feel.",
    aliases: ["Slider", "Range"],
    props: [
      prop("value", "number", "The value.", { required: true, bindable: true, data: true }),
      prop("min", "number", "Lowest value.", { required: true, data: true }),
      prop("max", "number", "Highest value.", { required: true, data: true }),
      prop("step", "number", "Step between values.", { default: "1", data: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("disabled", "boolean", "Disables it.", { default: "false" }),
      prop("valueWidth", '"normal" | "wide"', "Room for the value: wide for words such as a font weight.", {
        default: '"normal"',
      }),
      prop("format", "(value: number) => string", "How the value is shown, e.g. `13 px`.", {
        default: "(shown) => String(shown)",
        data: true,
      }),
      prop("resetValue", "number | null", "Double-click puts this value back (Settings' font weight).", {
        default: "null",
        data: true,
      }),
      prop("onchange", "(value: number) => void", "Called while it moves.", { data: true }),
    ],
    examples: [
      {
        title: "Font size",
        code: '<Slider label="Font size" bind:value={size} min={10} max={24} format={(value) => `${value} px`} />',
      },
    ],
    replaces: ['<div class="range"><input type="range" /><span class="value">...</span></div>'],
  },
  {
    name: "Field",
    group: "Forms",
    summary: "A labelled form field: the label, the control, then a hint or an error under it.",
    usage: "Wrap Input, TextArea or Select in dialogs. Show `error` only after the user typed, and keep it short.",
    aliases: ["Field", "Form item", "Label"],
    props: [
      prop("label", "string", "The label above the control.", { default: '""' }),
      prop("hint", "string", "Help under the control, hidden while there is an error.", { default: '""' }),
      prop("error", "string | null", "Validation message in red, announced to screen readers.", { default: "null" }),
      prop("look", '"normal" | "compact"', "Compact: the Git dialogs' smaller dim label and faint hint.", {
        default: '"normal"',
      }),
      prop("children", "Snippet", "The control.", { required: true }),
    ],
    examples: [
      {
        title: "Branch name",
        code:
          '<Field label="New branch name" {error}>\n' +
          "  <Input bind:value={name} invalid={error !== null} />\n</Field>",
      },
    ],
    replaces: ['<label class="field"><span>Label</span><input class="input" /></label>', '<div class="error">'],
  },
  {
    name: "SettingRow",
    group: "Forms",
    summary: "A Settings row: title and hint on the left, the control on the right, or under them when stacked.",
    usage: "Use for every setting in Settings and in settings-like panels. Put one control in it.",
    props: [
      prop("title", "string", "The setting's name.", { required: true }),
      prop("titleMatches", "[number, number][]", "Ranges [start, end) of the title a search found, in the " +
        "warning tint (Settings search).", { default: "[]", data: true }),
      prop("hint", "string", "One sentence on what it does; `backtick` words show as code, such as a git option.", {
        default: '""',
      }),
      prop("stacked", "boolean", "Control under the text, for wide controls.", { default: "false" }),
      prop("nested", "boolean", "Indented under the setting it belongs to.", { default: "false" }),
      prop("plain", "boolean", "No line between rows and a regular label (welcome screen).", { default: "false" }),
      prop("toggle", "boolean", "The whole row is its Switch's label: a click on the words flips it.", {
        default: "false",
      }),
      prop("mark", "Snippet", "Something small after the title, such as a memory cost flag."),
      prop("hintContent", "Snippet", "A rich hint (with a link) instead of `hint`."),
      prop("children", "Snippet", "The control.", { required: true }),
    ],
    examples: [
      {
        title: "Switch setting",
        code:
          '<SettingRow title="Word wrap" hint="Wrap long lines.">\n' +
          '  <Switch label="Word wrap" bind:checked={wrap} />\n</SettingRow>',
      },
      {
        title: "Search matches",
        code:
          '<SettingRow title="Word wrap" titleMatches={[[0, 4]]}>\n' +
          '  <Switch label="Word wrap" bind:checked={wrap} />\n</SettingRow>',
      },
    ],
    replaces: [
      '<div class="row"><div class="label"><span>Title</span><span class="hint">...</span></div>...</div>',
      "Settings search's CSS Custom Highlight (`::highlight(settings-search)`): pass the ranges instead",
    ],
  },
  {
    name: "SearchField",
    group: "Forms",
    summary: "A filter box with a magnifier and a clear button, like Settings' search. Esc clears, then blurs.",
    usage: "Use to filter a list as the user types. Use Input for values that are saved.",
    aliases: ["Input group", "Search"],
    props: [
      prop("value", "string", "The query.", { default: '""', bindable: true }),
      prop("placeholder", "string", "Shown while empty.", { default: '"Search"' }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("autofocus", "boolean", "Focus it when it appears.", { default: "false" }),
      prop("size", '"normal" | "large" | "compact" | "small"', "Large: 32px (Welcome); compact: 26px (panel " +
        "filters); small: 24px, a set width (Git Console).", {
        default: '"normal"',
      }),
      prop("width", "ControlWidth", "A preset width; auto fits the row.", { default: '"auto"' }),
      prop("element", "HTMLInputElement | null", "The input element.", { default: "null", bindable: true }),
      prop("oninput", "(value: string) => void", "Called on every change, also when cleared."),
      prop("onkeydown", "(event: KeyboardEvent) => void", "Runs first; call preventDefault to keep Esc."),
    ],
    examples: [{ title: "Filter", code: '<SearchField label="Filter files" bind:value={query} />' }],
    replaces: ['<div class="search"><Icon name="search" /><input /><button class="clear">'],
  },
];
