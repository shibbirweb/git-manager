import { prop, type ComponentDoc } from "./types";

const ROW_HEIGHT = '"compact" | "normal" | "relaxed" | "comfortable"';

export const largerDocs: ComponentDoc[] = [
  {
    name: "CommitGraph",
    group: "Editor",
    summary: "One row of the log's commit graph: lane lines in the palette's lane colors and the commit node.",
    usage: "Use as DataTable's `lead` in the log. The app computes lanes and edges; this draws one row.",
    aliases: ["Graph"],
    props: [
      prop("row", "GraphRowData ({ lane; color; edges: [kind, from, to, color]... })", "The row's lanes.", {
        required: true,
        data: true,
      }),
      prop("laneCount", "number", "Lanes in the whole log, for the column width.", { required: true, data: true }),
      prop("rowHeight", ROW_HEIGHT, "The table's row height: 22, 24, 26 or 28 px.", { default: '"relaxed"' }),
      prop("head", "boolean", "The checked-out commit: a halo around the node.", { default: "false" }),
      prop("merge", "boolean", "A merge commit: a ring instead of a dot.", { default: "false" }),
      prop("nodeOnly", "boolean", "Only the node, while the log is filtered.", { default: "false" }),
    ],
    examples: [{ title: "In the log", code: "<CommitGraph row={graph[index]} {laneCount} head={isHead} />" }],
    logic: ["graphModel.ts"],
    replaces: ["src/lib/log/GraphCell.svelte"],
  },
  {
    name: "DataTable",
    group: "Navigation",
    summary: "A table of many rows with a header, like the log: named column widths, a lead column, selection.",
    usage:
      "Use for long lists with columns (commits, remotes, shortcuts). Only rows in view are drawn. Draw cells " +
      "with the `cell` snippet, or let the table show the row's value under each column id. The keys are List's " +
      "(arrows, Page keys, Home, End, Enter). `focus()` takes the focus and `reveal(key, place)` scrolls a row the " +
      "app selected into view, to the middle with `center` (a commit opened from blame).",
    aliases: ["Table", "Data table", "Grid"],
    props: [
      prop("columns", "DataColumn[] ({ id; label; width: fill|xsmall|small|side|medium|large; tone?; mono?; small? })",
        "The columns; widths are 82, 110, 150 or 220 px, or the rest of the row.", { required: true }),
      prop("rows", "T[]", "All rows.", { required: true, data: true }),
      prop("rowKey", "(row: T) => string", "A row's id.", { required: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("rowHeight", ROW_HEIGHT, "Every row's height.", { default: '"relaxed"' }),
      prop("height", '"fill" | "small" | "medium" | "large"', "Fill the parent, or 160, 240 or 360 px.", {
        default: '"fill"',
      }),
      prop("selected", "string | null", "The selected row's id.", { default: "null", bindable: true }),
      prop("leadWidth", "number", "The lead column's width, such as the graph's.", { default: "0", data: true }),
      prop("strong", "(row: T) => boolean", "Rows whose first column is bold (HEAD).", { default: "() => false" }),
      prop("field", "HTMLInputElement | null", "A filter field above it: Down or Enter there moves the focus in.", {
        default: "null",
      }),
      prop("lead", "Snippet<[T]>", "A column before the others, such as CommitGraph."),
      prop("cell", "Snippet<[T, DataColumn]>", "Draws a cell."),
      prop("empty", "Snippet", "Shown under the header when there are no rows, such as an EmptyState."),
      prop("onopen", "(row: T) => void", "Double-click or Enter."),
      prop("oncontextmenu", "(row: T, event: MouseEvent) => void", "Right-click, for its Menu."),
      prop("onnearend", "() => void", "Scrolled near the end: load the next page (once per row count)."),
    ],
    examples: [
      { title: "Commits", code: '<DataTable label="Commits" {columns} rows={commits} rowKey={(c) => c.id} />' },
    ],
    logic: ["table.ts", "listWiring.svelte.ts"],
    replaces: ['the .columns header and .row list of LogView.svelte', "RemotesDialog and McpToolsDialog lists"],
  },
  {
    name: "CommandPalette",
    group: "Overlays",
    summary: "A floating list at the top of the window to find and run something, like Go to File.",
    usage:
      "Use for Go to File, Recent Files, Search Everywhere and commands. Filter in the caller (on `query`) and " +
      "pass the matching items with their match ranges; give sections to group them. It exports step(by), to " +
      "move the highlight when the key that opened it is pressed again, and highlighted(), for a key that acts on " +
      "the highlighted item. Removing the highlighted item keeps the highlight at the same place.",
    aliases: ["Command", "Quick open", "Combobox"],
    props: [
      prop("open", "boolean", "Shown or hidden.", { default: "true", bindable: true }),
      prop("items", "PaletteItem[] ({ id; title; ranges?; icon?; fileIcon?; badge?; category?; categoryRanges?; " +
        "depth?; container?; detail?; folder?; folderRanges?; tooltip?; keys?; prefix?; section?; checked?; " +
        "disabled?; reason?; tone?; dirty? })",
        "The matching items; see logic/palette.ts.", { default: "[]", data: true }),
      prop("query", "string", "What was typed.", { default: '""', bindable: true }),
      prop("placeholder", "string", "Shown while empty.", { default: '"Type to search"' }),
      prop("status", "string", "Faint text at the field's end, such as a count.", { default: '""' }),
      prop("statusTone", '"faint" | "warning"', "Warning for a note such as an index still loading.", {
        default: '"faint"',
      }),
      prop("emptyText", "string", "Shown when nothing matches.", { default: '"Nothing found"' }),
      prop("fieldIcon", "IconName", "The field's icon, such as carets in command mode.", { default: '"search"' }),
      prop("fieldSize", '"normal" | "compact"', "The field's height: 38 or 34 px (Recent Files).", {
        default: '"normal"',
      }),
      prop("size", '"normal" | "wide"', "Wide for Search Everywhere's longer rows.", { default: '"normal"' }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("onpick", "(item: PaletteItem, event: KeyboardEvent | MouseEvent) => void", "An item was picked; the " +
        "event tells whether Cmd (Ctrl) was held, to open to the side."),
      prop("onkeydown", "(event: KeyboardEvent) => void", "Runs first for keys in the field; preventDefault keeps a " +
        "key from the palette (switching modes, Tab)."),
      prop("onclose", "() => void", "Esc or a click outside."),
      prop("head", "Snippet", "A title bar above the field, with filters (Recent Files)."),
      prop("scopes", "Snippet", "Scope tabs above the field, such as All, Files, Symbols."),
      prop("preferred", "string | null", "The item highlighted when the query is new, such as the file before the " +
        "one on screen.", { default: "null", data: true }),
      prop("rowEnd", "Snippet<[PaletteItem]>", "Buttons at a row's end, such as Remove; shown while hovered or " +
        "selected."),
      prop("fieldStart", "Snippet", "Before the field's icon, such as the chevron that shows a Replace field."),
      prop("fieldEnd", "Snippet", "Toggles at the field's end, such as Match Case."),
      prop("results", "Snippet", "The caller's own results instead of `items`, such as a virtual List driven by " +
        "`field` (Search Everywhere); arrows and Enter are left to it."),
      prop("field", "HTMLInputElement | null", "The search field, to drive a List in `results`.", {
        default: "null",
        bindable: true,
      }),
      prop("replace", "Snippet", "A second row under the field, such as a replace field."),
      prop("footer", "Snippet", "Key hints under the list."),
    ],
    examples: [{ title: "Go to File", code: '<CommandPalette label="Go to File" {items} bind:query onpick={open} />' }],
    logic: ["palette.ts"],
    replaces: ["src/lib/quickOpen/QuickOpen.svelte", "src/lib/recentFiles/RecentFiles.svelte popups"],
  },
  {
    name: "ReorderList",
    group: "Navigation",
    summary: "Rows the user orders by dragging, like Interactive Rebase's commits.",
    usage:
      "Use for short lists whose order matters. Up and Down move between rows; Alt+Up and Alt+Down move the " +
      "focused row and the focus follows it. Keys typed in a control inside a row stay with that control. Near " +
      "the edges a drag scrolls the list; Escape cancels it.",
    aliases: ["Sortable", "Drag list"],
    props: [
      prop("items", "T[]", "The rows in order.", { required: true, data: true }),
      prop("itemKey", "(item: T) => string", "A row's id.", { required: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("onreorder", "(from: number, to: number) => void", "A row moved.", { required: true, data: true }),
      prop("row", "Snippet<[T, number]>", "Draws a row after its grip.", { required: true, data: true }),
      prop("rowLabel", "(item: T) => string", "What screen readers say for a row, before its move hint."),
      prop("canDrop", "(from: number, to: number) => boolean", "Whether a dragged row may land there; a refused " +
        "place shows no line.", { default: "() => true" }),
      prop("dragBy", '"grip" | "row"', "Drag by the grip only, or anywhere on the row but its controls.", {
        default: '"grip"',
      }),
      prop("maxHeight", '"none" | "xsmall" | "small" | "medium" | "large"', "Scrolls past 120, 160, 240 or 360 px.", {
        default: '"none"',
      }),
      prop("onkey", "(event: KeyboardEvent, index: number) => void", "Keys on a focused row it does not use, such " +
        "as a rebase action's letter."),
      prop("heading", "Snippet<[T, number]>", "Drawn above a row and not dragged, such as a group's title.", {
        data: true,
      }),
      prop("detail", "Snippet<[T, number]>", "Drawn under a row inside its place, such as a message box.", {
        data: true,
      }),
    ],
    examples: [
      { title: "Rebase", code: '<ReorderList label="Commits" {items} itemKey={(c) => c.id} {onreorder}>...' },
    ],
    logic: ["reorder.ts", "treeDrag.ts"],
    replaces: [".rows / .row-wrap / .grip in InteractiveRebaseDialog.svelte"],
  },
  {
    name: "ShortcutRecorder",
    group: "Forms",
    summary: "A command's keys that can be changed: click, press the new keys, Esc cancels.",
    usage: "Use in the Keyboard Shortcuts list. The app turns the key press into keys and checks it.",
    aliases: ["Hotkey input"],
    props: [
      prop("keys", "string", "The current keys from commandKeys(id); empty shows None.", { required: true }),
      prop("recording", "boolean", "Listening for the new keys.", { default: "false", bindable: true }),
      prop("pending", "string | null", "What was just pressed, shown while recording.", { default: "null" }),
      prop("label", "string", "The command's name.", { required: true }),
      prop("onrecord", "(event: KeyboardEvent) => void", "A key press while recording.", { required: true }),
      prop("oncancel", "() => void", "Esc while recording."),
    ],
    examples: [
      { title: "A command", code: '<ShortcutRecorder label="Commit" keys={commandKeys("commit")} {onrecord} />' },
    ],
    replaces: [".keys and .recorder in KeyboardShortcuts.svelte"],
  },
];
