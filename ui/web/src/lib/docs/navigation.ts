import { prop, type ComponentDoc } from "./types";

export const navigationDocs: ComponentDoc[] = [
  {
    name: "TabStrip",
    group: "Navigation",
    summary: "The editor's tab strip: icon, name, hint and a close button; a dot for unsaved edits, italic previews.",
    usage:
      "Use above an editor group. Gray the active tab's accent line with `focused={false}` when another group " +
      "has the focus. Put a + button in `trailing`. The active tab is kept in view and the wheel scrolls one row " +
      "sideways. With `onreorder`, a dragged tab follows the pointer while the others slide aside; Escape cancels.",
    aliases: ["Tabs", "Editor tabs"],
    props: [
      prop(
        "tabs",
        "{ id: string; label: string; icon?: IconName; hint?: string; title?: string; preview?: boolean; " +
          "dirty?: boolean; pinned?: boolean }[]",
        "The tabs in order.",
        { required: true },
      ),
      prop("active", "string | null", "The active tab's id.", { default: "null", bindable: true }),
      prop("label", "string", "Accessible name of the strip.", { required: true }),
      prop("focused", "boolean", "The group has the focus: accent line instead of gray.", { default: "true" }),
      prop("layout", '"scroll" | "wrap" | "single"', "One scrolling row, wrapped rows, or a lone centered name.", {
        default: '"scroll"',
      }),
      prop("newLabel", "string", "The + button's name and tooltip.", { default: '"New tab"' }),
      prop("onselect", "(id: string) => void", "A tab was clicked."),
      prop("ondblclick", "(id: string) => void", "A tab was double-clicked, such as to keep a preview tab open."),
      prop("onclose", "(id: string) => void", "Close button or middle click; without it there is no close button."),
      prop("oncontextmenu", "(id: string, event: MouseEvent) => void", "Right-click on a tab, for its Menu."),
      prop("onnew", "(event: MouseEvent) => void", "Shows a + after the tabs; open a Menu from it."),
      prop("onreorder", "(from: number, to: number) => void", "Tabs can be dragged; called with the move.", {
        data: true,
      }),
      prop("trailing", "Snippet", "More content after the tabs."),
    ],
    examples: [
      { title: "Editor tabs", code: '<TabStrip label="Editor tabs" {tabs} bind:active onclose={closeTab} />' },
    ],
    logic: ["tabDrag.ts", "slide.ts", "reorder.ts"],
    replaces: ['<div class="tab-strip"> in EditorTabs.svelte'],
  },
  {
    name: "Tabs",
    group: "Navigation",
    summary: "Panel tabs in small capitals with an accent underline, like Terminal / Run / Git Console.",
    usage: "Use in a panel header to switch its views. Use Segmented for a setting with a few choices.",
    aliases: ["Tabs"],
    props: [
      prop("tabs", "{ value: T; label: string }[]", "The tabs in order.", { required: true }),
      prop("value", "T extends string", "The shown tab.", { required: true, bindable: true }),
      prop("label", "string", "Accessible name of the tab list.", { required: true }),
      prop("variant", '"panel" | "underline"', "Panel tabs in small capitals, or normal words with a thick " +
        "line under the chosen one (Search Everywhere's scopes).", { default: '"panel"' }),
      prop("keepFocus", "boolean", "Tabs over a search field: pressing one leaves the focus in the field, and " +
        "the tabs take no focus.", { default: "false" }),
      prop("onchange", "(value: T) => void", "Called when the user picks another tab."),
    ],
    examples: [{ title: "Bottom panel", code: '<Tabs label="Panel views" bind:value={tab} {tabs} />' }],
    logic: ["roving.ts"],
    replaces: ['<div class="tabs" role="tablist"> in TerminalPanel.svelte'],
  },
  {
    name: "Tree",
    group: "Navigation",
    summary: "A file-tree list: folders open and close, rows indent by depth, and only rows in view are drawn.",
    usage:
      "Use for folders and files or any nested list. Give folders a `children` array (empty when nothing is in " +
      "them). Keys work like the Files panel; double-click or Enter opens a file.",
    aliases: ["Tree view", "File tree"],
    props: [
      prop("nodes", "N extends TreeNode ({ id: string; label: string; children?: N[] })[]", "The top level.", {
        required: true,
      }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("expanded", "string[]", "Ids of open folders.", { default: "[]", bindable: true }),
      prop("selected", "string | null", "The selected (focused) row's id.", { default: "null", bindable: true }),
      prop("multiple", "boolean", "Cmd/Ctrl-click adds, Shift-click selects a range.", { default: "false" }),
      prop("selection", "string[]", "Selected ids when `multiple`.", { default: "[]", bindable: true }),
      prop("focused", "boolean", "Show the selection in the focus color while the tree has the focus.", {
        default: "true",
      }),
      prop("height", '"fill" | "small" | "medium" | "large"', "Fill the parent, or 160, 240 or 360 px.", {
        default: '"fill"',
      }),
      prop("renaming", "string | null", "The row being renamed in place.", { default: "null", bindable: true }),
      prop("reveal", '"nearest" | "center"', "How the selected row comes into view: at the nearest edge, or " +
        "in the middle when it was out of view (a located file).", { default: '"nearest"' }),
      prop("draggable", "boolean", "Rows can be dragged onto folders with the pointer: a ghost follows, Option " +
        "copies, a hovered closed folder opens, the list scrolls near its edges, Escape cancels.", {
        default: "false",
      }),
      prop("dropRoot", "boolean", "A drop into the top folder: the whole list is outlined.", { default: "false" }),
      prop("iconFor", "(node: N, open: boolean) => IconName | null", "Icon per row.", {
        default: '(node) => (node.children ? "folder" : "file")',
      }),
      prop("decorate", "(node: N) => TreeDecoration | null", "A row's tone, strike, badge, cut, ignored, root " +
        "(a workspace folder's header), repo (accent icon) and tag (LFS).", {
        default: "() => null",
      }),
      prop("detail", "Snippet<[N]>", "Dim content at the end of a row."),
      prop("onopen", "(node: N) => void", "A file was opened (double-click or Enter)."),
      prop("onrename", "(node: N, name: string) => void", "A rename was confirmed with Enter."),
      prop("ondrop", '(ids: string[], target: N | null, mode: "move" | "copy") => void', "Rows were dropped " +
        "onto a folder, or onto the top level (null); never into themselves or where they already are."),
      prop("oncontextmenu", "(node: N, event: MouseEvent) => void", "Right-click on a row, for its Menu."),
    ],
    examples: [
      { title: "Files", code: '<Tree label="Files" {nodes} bind:expanded bind:selected onopen={openFile} />' },
    ],
    logic: ["treeModel.ts", "treeDrag.ts", "treeDragger.svelte.ts", "virtualWindow.ts"],
    replaces: ["the rows of FileExplorer.svelte"],
  },
  {
    name: "VirtualList",
    group: "Navigation",
    summary: "A long list that draws only the rows in view, for thousands of rows of one fixed height.",
    usage: "Use for long lists such as commits or search results. `keepInView` scrolls a selected row into view.",
    aliases: ["Virtual list", "Scroll area"],
    props: [
      prop("items", "T[]", "All rows.", { required: true }),
      prop("rowHeight", '"compact" | "normal" | "comfortable"', "Every row's height: 22, 24 or 28 px.", {
        default: '"normal"',
      }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("keepInView", "number | null", "Index to scroll into view when it changes.", {
        default: "null",
        data: true,
      }),
      prop("reveal", '"nearest" | "center"', "Bring that row to the nearest edge, or to the middle when it is " +
        "out of view.", { default: '"nearest"' }),
      prop("element", "HTMLDivElement | null", "The scrolling element, to scroll it from outside.", {
        default: "null",
        bindable: true,
      }),
      prop("height", '"fill" | "small" | "medium" | "large"', "Fill the parent, or 160, 240 or 360 px.", {
        default: '"fill"',
      }),
      prop("row", "Snippet<[T, number]>", "Draws one row from its item and index.", { required: true, data: true }),
    ],
    examples: [
      {
        title: "Commits",
        code:
          '<VirtualList items={commits} label="Commits">\n' +
          "  {#snippet row(commit)}<Text truncate>{commit.subject}</Text>{/snippet}\n</VirtualList>",
      },
    ],
    logic: ["virtualWindow.ts"],
    replaces: ['<div class="spacer-rows"> windowing in FileExplorer, LogView and search results'],
  },
  {
    name: "Collapsible",
    group: "Navigation",
    summary: "A section whose header opens and closes it: chevron, bold title, count and hover actions.",
    usage: "Use for groups in a list, like Staged Changes. Actions show while the header is hovered or focused.",
    aliases: ["Accordion", "Collapsible", "Disclosure"],
    props: [
      prop("title", "string", "The group's name.", { required: true }),
      prop("open", "boolean", "Open or closed.", { default: "true", bindable: true }),
      prop("count", "number | null", "A dim number after the title.", { default: "null", data: true }),
      prop("nested", "boolean", "Indent the header, for a group inside a repository.", { default: "false" }),
      prop("dim", "boolean", "A quieter section, like the repositories with No Changes.", { default: "false" }),
      prop("actions", "Snippet", "Small buttons on the right of the header."),
      prop("ontoggle", "(open: boolean) => void", "Called when the user opens or closes it."),
      prop("children", "Snippet", "The rows, shown while open.", { required: true }),
    ],
    examples: [{ title: "Changes group", code: '<Collapsible title="Changes" count={files.length}>...</Collapsible>' }],
    replaces: ['<div class="group-header"><button class="group-toggle"> in RepoSection.svelte'],
  },
  {
    name: "ListRow",
    group: "Navigation",
    summary: "A row of a pick or command list: a label and a dim description; the highlighted row is accent-filled.",
    usage: "Use inside PickList-like lists. Use Tree rows for files and Menu for commands.",
    aliases: ["Item", "Option"],
    props: [
      prop("label", "string", "The main text.", { required: true }),
      prop("description", "string", "Dim text after the label.", { default: '""' }),
      prop("icon", "IconName | null", "An icon before the label.", { default: "null" }),
      prop("highlighted", "boolean", "The keyboard or pointer row.", { default: "false" }),
      prop("disabled", "boolean", "Cannot be picked.", { default: "false" }),
      prop("onclick", "() => void", "Picked with the pointer."),
      prop("onhover", "() => void", "The pointer moved over it, to move the highlight."),
      prop("trailing", "Snippet", "Content at the right end."),
    ],
    examples: [{ title: "Branch", code: '<ListRow icon="branch" label="main" description="current" highlighted />' }],
    replaces: ['<button class="pick-row"> in DialogHost.svelte'],
  },
  {
    name: "PickList",
    group: "Navigation",
    summary: "A filterable list to pick one item: words filter, arrows move, Enter picks, Esc cancels.",
    usage: "Use inside a Dialog for choosing a branch, a remote or a file. Pinned items always show.",
    aliases: ["Command", "Combobox", "Quick pick"],
    props: [
      prop("items", "PickItem<T>[] (logic/pickModel.ts)", "The choices, optionally grouped.", { required: true }),
      prop("label", "string", "Accessible name of the filter and list.", { required: true }),
      prop("placeholder", "string", "Filter placeholder.", { default: '"Type to filter"' }),
      prop("emptyText", "string", "Shown when nothing matches.", { default: '"Nothing matches"' }),
      prop("query", "string", "The filter text.", { default: '""', bindable: true }),
      prop("onpick", "(value: T) => void", "An item was picked.", { required: true }),
      prop("oncancel", "() => void", "Esc was pressed."),
    ],
    examples: [{ title: "Checkout", code: '<PickList label="Branch" {items} onpick={checkout} />' }],
    logic: ["pickModel.ts"],
    replaces: ["dialogs.pick({ title, items }) and its pick rows"],
  },
  {
    name: "Breadcrumbs",
    group: "Navigation",
    summary: "A path as crumbs separated by chevrons, like the Navigation Bar; the file is bold.",
    usage: "Use above an editor for the file's path. Open a list of a folder's files from `onselect`.",
    aliases: ["Breadcrumb", "Path bar"],
    props: [
      prop("crumbs", '{ label: string; icon?: IconName; kind?: "repo" | "folder" | "file" }[]', "The parts.", {
        required: true,
      }),
      prop("label", "string", "Accessible name.", { default: '"Path"' }),
      prop("open", "number | null", "Index of the crumb whose list shows.", { default: "null", data: true }),
      prop("variant", '"inline" | "floating" | "anchored"', "In a bar; floating over the editor; or under the " +
        "tabs, anchored to the editor's top.", { default: '"inline"' }),
      prop("onselect", "(index: number, element: HTMLElement) => void", "A crumb was clicked.", { data: true }),
    ],
    examples: [
      { title: "File path", code: '<Breadcrumbs crumbs={parts} onselect={(index, element) => list(index)} />' },
    ],
    replaces: ['<button class="crumb"> in NavigationBar.svelte'],
  },
];
