import { prop, type ComponentDoc } from "./types";

export const pickerDocs: ComponentDoc[] = [
  {
    name: "Table",
    group: "Navigation",
    summary: "A short table in a bordered box: a sticky header and 28 px rows that can be selected.",
    usage: "Use for small tables in dialogs, such as the conflicts. For long lists use DataTable.",
    aliases: ["Grid", "Simple table"],
    props: [
      prop("columns", "DataColumn[] ({ id; label; width: fill|xsmall|small|side|medium|large })", "The columns.", {
        required: true,
      }),
      prop("rows", "T[]", "The rows.", { required: true, data: true }),
      prop("rowKey", "(row: T) => string", "A row's id.", { required: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("selected", "string | null", "The selected row's id (the last one picked).", {
        default: "null",
        bindable: true,
      }),
      prop("multiple", "boolean", "Cmd or Ctrl click adds a row, Shift click a range.", { default: "false" }),
      prop("selection", "string[]", "The selected rows' ids, with `multiple`.", { default: "[]", bindable: true }),
      prop("cell", "Snippet<[T, DataColumn]>", "Draws a cell.", { required: true }),
      prop("onselect", "(row: T) => void", "A row was pressed."),
      prop("onopen", "(row: T) => void", "A row was double-clicked."),
    ],
    examples: [
      {
        title: "Conflicts",
        code: '<Table label="Conflicts" {columns} rows={files} rowKey={(f) => f.path} {cell} />',
      },
    ],
    logic: ["table.ts", "treeSelect.ts"],
    replaces: [".table in src/lib/merge/ConflictsDialog.svelte"],
  },
  {
    name: "PopupRow",
    group: "Navigation",
    summary: "A row of a picker popup: an action, or an item with an icon, a name, a hint and a chevron.",
    usage: "Use in the branches popup; the highlighted row takes the selection color.",
    aliases: ["Branch row", "Picker row"],
    props: [
      prop("label", "string", "The words.", { required: true, data: true }),
      prop("variant", '"action" | "item"', "An action, or an item in a grid.", { default: '"item"' }),
      prop("icon", "IconName | null", "An icon first.", { default: "null" }),
      prop("hint", "string", "A dim hint.", { default: '""', data: true }),
      prop("current", "boolean", "The current one, bold.", { default: "false" }),
      prop("chevron", "boolean", "Opens more.", { default: "false" }),
      prop("highlighted", "boolean", "The highlighted row.", { default: "false" }),
      prop("disabled", "boolean", "Cannot be picked.", { default: "false" }),
      prop("onclick", "() => void", "Picked."),
      prop("onhover", "() => void", "The pointer moved over it."),
    ],
    examples: [{ title: "A branch", code: '<PopupRow icon="branch" label="main" current chevron />' }],
    replaces: [".action and .branch in src/lib/views/git/BranchesPopup.svelte"],
  },
  {
    name: "OptionList",
    group: "Forms",
    summary: "A bordered list to pick one option from, in groups, like Settings' color themes.",
    usage:
      "Draw each option in `option` (a ThemeSwatch and a name). The arrows, Home, End and the page keys move, and " +
      "the picked option stays in view.",
    logic: ["optionMove.ts"],
    aliases: ["Listbox", "Theme list"],
    props: [
      prop("groups", "{ label; options: T[] }[]", "The groups.", { required: true, data: true }),
      prop("optionKey", "(option: T) => string", "An option's id.", { required: true }),
      prop("value", "string | null", "The picked option's id.", { default: "null", bindable: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("option", "Snippet<[T]>", "Draws an option.", { required: true }),
      prop("onpick", "(option: T) => void", "An option was picked."),
    ],
    examples: [
      {
        title: "Themes",
        code: '<OptionList label="Theme" {groups} optionKey={(t) => t.id} bind:value {option} />',
      },
    ],
    replaces: [".list and .option in src/lib/views/settings/ColorThemePicker.svelte"],
  },
  {
    name: "CrumbPopup",
    group: "Overlays",
    summary: "The list under a breadcrumb: a filter field, then the folder's entries in their git colors.",
    usage: "Open it from Breadcrumbs' onselect and place it under the crumb.",
    aliases: ["Folder popup", "Nav popup"],
    props: [
      prop("entries", "{ id; name; icon?; tone?; folder? }[]", "The entries.", { required: true, data: true }),
      prop("query", "string", "The filter.", { default: '""', bindable: true }),
      prop("placeholder", "string", "The filter's placeholder.", { default: '"Filter"' }),
      prop("message", "string", "Shown when there are no entries.", { default: '""' }),
      prop("error", "boolean", "The message is an error.", { default: "false" }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("onpick", "(entry) => void", "An entry was picked.", { required: true }),
      prop("onclose", "() => void", "Escape."),
    ],
    examples: [{ title: "A folder", code: '<CrumbPopup label="src" {entries} onpick={open} />' }],
    replaces: [".nav-popup in src/lib/navBar/NavigationBar.svelte"],
  },
];
