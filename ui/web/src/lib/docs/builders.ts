import { prop, type ComponentDoc } from "./types";

const ROW_SIZE = '"tree" | "list" | "history" | "entry" | "large"';
const ROW_HEIGHT = '"compact" | "normal" | "relaxed" | "comfortable" | null';
const VIEW_HEIGHT = '"auto" | "fill" | "small" | "medium" | "large"';

export const builderDocs: ComponentDoc[] = [
  {
    name: "Row",
    group: "Layout",
    summary: "One row of a list: hover, selected color, fold chevron, indent and hover actions around your content.",
    usage:
      "Build every list row from it: put Icon, Text, Tag, StatusLetter and the like inside, and a Spacer before " +
      "what sits at the end. Pick the size for the place: tree (24 px, sidebars), list (24 px, file lists), " +
      "history (26 px, commit lists), entry (grows, 4 px above and below, dialogs) or large (56 px, Welcome). " +
      "Put Rows in a List for the keyboard and selection; alone, a Row with `onclick` is a button.",
    aliases: ["List item", "Item", "Row", "Cell"],
    props: [
      prop("size", ROW_SIZE, "Height, side padding and gap for the place it is used.", { default: '"list"' }),
      prop("selected", "boolean", "The selected row; stronger while its List has the focus.", { default: "false" }),
      prop("disabled", "boolean", "Faint and cannot be pressed.", { default: "false" }),
      prop("depth", "number", "Indent levels, for nested rows.", { default: "0", data: true }),
      prop("expanded", 'boolean | "leaf" | null', "A fold chevron; leaf keeps its room empty, null has none.", {
        default: "null",
      }),
      prop("align", '"center" | "baseline"', "Baseline for rows of words in two sizes.", { default: '"center"' }),
      prop("actionsShown", '"hover" | "always"', "Show `actions` only on hover and focus, or always.", {
        default: '"hover"',
      }),
      prop("line", "boolean", "A line under the row, for rows in a ListBox (the last one has none).", {
        default: "false",
      }),
      prop("title", "string", "Tooltip, such as the full path."),
      prop("label", "string", "Accessible name, when the content alone does not say it."),
      prop("actions", "Snippet", "Small buttons at the end; their clicks do not select the row."),
      prop("children", "Snippet", "The row's content.", { required: true }),
      prop("onclick", "(event: MouseEvent) => void", "Pressed (outside a List, this makes it a button)."),
      prop("ondblclick", "(event: MouseEvent) => void", "Double-clicked."),
      prop("oncontextmenu", "(event: MouseEvent) => void", "Right-clicked, for its Menu."),
      prop("onhover", "() => void", "The pointer moved over it, to move a highlight."),
    ],
    examples: [
      {
        title: "A commit in a history list",
        code:
          '<Row size="history" selected={id === selectedId}>\n' +
          '  <Text mono tone="dim" size="compact">{hash}</Text>\n' +
          "  <Text truncate>{subject}</Text>\n" +
          "  <Spacer />\n" +
          '  <Text tone="dim" tabular>{when}</Text>\n' +
          "</Row>",
      },
      {
        title: "A folding row with hover actions",
        code:
          '<Row size="tree" expanded={open} depth={1}>\n' +
          '  <Icon name="stash" size="normal" />\n' +
          "  <Text truncate>{name}</Text>\n" +
          '  {#snippet actions()}<IconButton icon="trash" label="Delete" size="mini" />{/snippet}\n' +
          "</Row>",
      },
    ],
    replaces: [
      ".entry in FileHistoryTab, LineHistoryTab and ReflogTab",
      ".version and .deleted-row in LocalHistoryDialog",
      ".entry and .file in ShelfPanel",
      ".item in TerminalPanel, .row in ScriptsPanel and TerminalMemory",
      ".agent, .project and .card-head in AiPanel",
      ".commit in BranchCompareTab and PushDialog, .branch in BranchesPopup",
      ".row in GitConsoleView, .call in McpToolsDialog, .action in EmptyMain",
      ".project and .learn-item in Welcome",
    ],
    rules: [
      "Lay out the content with Text and Icon in the Row; use Stack grow for a column of two lines.",
      "Action buttons go in `actions`, never in the content, so they show on hover and keep the row's click.",
    ],
  },
  {
    name: "List",
    group: "Navigation",
    summary: "The keyboard and selection around Rows: a listbox, a tree or a plain list, optionally virtual.",
    usage:
      "Give it the items and a `row` snippet that draws a Row with the state it gets. Arrows, Home, End and " +
      "Page keys move, Enter or a double-click activates, Left and Right fold tree rows, `multiple` selects " +
      "several. `skip` names headings the keys pass over. `virtual` draws only the rows in view: give it the " +
      "Row's height (normal for tree and list rows, relaxed for history rows).",
    aliases: ["Listbox", "Tree view", "Selectable list", "Virtual list"],
    props: [
      prop("items", "T[]", "Every row's item, headings included.", { required: true, data: true }),
      prop("itemKey", "(item: T) => string", "An item's id.", { required: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("role", '"listbox" | "tree" | "list"', "A pick list, a tree, or a plain list with no selection.", {
        default: '"listbox"',
      }),
      prop("selected", "string | null", "The current row's id.", { default: "null", bindable: true }),
      prop("selection", "string[]", "The selected rows' ids, with `multiple`.", { default: "[]", bindable: true }),
      prop("multiple", "boolean", "Cmd or Ctrl adds a row, Shift a range, Cmd+A all.", { default: "false" }),
      prop("skip", "(item: T) => boolean", "Rows that cannot be picked, such as group headings.", {
        default: "() => false",
      }),
      prop("level", "(item: T) => number", "A tree row's level, 0 at the top.", { default: "() => 0" }),
      prop("expanded", "(item: T) => boolean | null", "Whether a tree row is open; null for a leaf.", {
        default: "() => null",
      }),
      prop("height", VIEW_HEIGHT, "Its content's height, its parent's, or scroll past 160, 240 or 360 px.", {
        default: '"auto"',
      }),
      prop("virtual", ROW_HEIGHT, "Draw only the rows in view, each this tall.", { default: "null" }),
      prop("row", "Snippet<[T, ListRowState]>", "Draws a row from its item and { index, selected, current }.", {
        required: true,
      }),
      prop("empty", "Snippet", "Shown when there are no items, such as an EmptyState."),
      prop("onselect", "(item: T) => void", "A row was selected by click or key."),
      prop("onactivate", "(item: T) => void", "Enter or a double-click on a row."),
      prop("ontoggle", "(item: T, open: boolean) => void", "Left or Right asks to fold or unfold a tree row."),
      prop("oncontextmenu", "(event: MouseEvent, item: T) => void", "Right-clicked; the row is selected first."),
    ],
    logic: ["listNav.ts", "treeSelect.ts", "virtualWindow.ts"],
    examples: [
      {
        title: "Changed files",
        code:
          '<List label="Changed files" items={files} itemKey={(f) => f.path} bind:selected onactivate={open}>\n' +
          "  {#snippet row(file, state)}\n" +
          "    <Row selected={state.selected}>\n" +
          "      <StatusLetter kind={file.kind} /><Text truncate>{file.name}</Text>\n" +
          "    </Row>\n" +
          "  {/snippet}\n" +
          "</List>",
      },
    ],
    replaces: [
      ".files in ChangesTab and BranchFileList, .list in FileHistoryTab, LineHistoryTab and ReflogTab",
      ".versions in LocalHistoryDialog, .tree in ScriptsPanel and Sidebar, .list in AiPanel and ShelfPanel",
      ".table in ConflictsDialog, .list in TerminalPanel",
    ],
    rules: ["The List holds the focus; Rows inside take none and draw only their look."],
  },
  {
    name: "Spacer",
    group: "Layout",
    summary: "Takes the free room in a row, so what comes after it sits at the far end.",
    usage:
      "Use in a Row, a Toolbar or a row Stack: a title, a Spacer, then the buttons. With only two groups, " +
      'Stack\'s justify="between" does the same.',
    aliases: ["Spacer", "Flex fill"],
    props: [],
    examples: [
      {
        title: "Panel bar",
        code: '<Stack direction="row" align="center"><Text>Shelf</Text><Spacer /><Button>Shelve</Button></Stack>',
      },
    ],
    replaces: [".spacer in about 35 app files"],
  },
];
