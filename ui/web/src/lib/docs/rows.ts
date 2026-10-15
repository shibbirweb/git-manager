import { prop, type ComponentDoc } from "./types";

const KIND =
  '"added" | "modified" | "typechange" | "deleted" | "renamed" | "copied" | "untracked" | "conflicted" | null';
const VIEW = '{ kind: "image"; src: string } | { kind: "mask"; className: string } | null';
const DEPTH = '"none" | "one" | "two" | "three"';

export const rowDocs: ComponentDoc[] = [
  {
    name: "PanelHeader",
    group: "Layout",
    summary: "A panel's header: its title in small capitals on the left, its action buttons on the right.",
    usage: "Use at the top of every side and bottom panel. Put IconButtons with size compact in `actions`.",
    props: [
      prop("title", "string", "The panel's name; it shortens first when the panel is narrow.", { required: true }),
      prop("count", "number | null", "A quiet count after the title, such as the number of changed files.", {
        default: "null",
        data: true,
      }),
      prop("actions", "Snippet", "Buttons on the right."),
    ],
    examples: [
      {
        title: "Changes panel",
        code:
          '<PanelHeader title="Changes">\n  {#snippet actions()}\n' +
          '    <IconButton icon="refresh" label="Refresh" size="compact" iconSize="medium" />\n  {/snippet}\n' +
          "</PanelHeader>",
      },
    ],
    replaces: [
      "PanelHead.svelte",
      '<header class="head"> in TerminalPanel.svelte',
      '<div class="head"> with its .count in ChangesView.svelte',
    ],
  },
  {
    name: "StatusLetter",
    group: "Feedback",
    summary: "A changed file's status letter in its color: A, M, D, R, U, C or T.",
    usage: "Use before a file name wherever changes are listed. FileRow already shows it.",
    props: [prop("kind", KIND, "The change; null for a conflict.", { required: true })],
    examples: [{ title: "Modified", code: '<StatusLetter kind="modified" />' }],
    logic: ["fileStatus.ts"],
    replaces: ['<span class="letter kind-...">M</span> in FileRow.svelte'],
  },
  {
    name: "FileIcon",
    group: "Feedback",
    summary: "A file's type icon, resolved by the app from the chosen icon set and passed in as `view`.",
    usage: "Use beside file names. Without a view it shows the plain file icon, or nothing when `plain` is false.",
    props: [
      prop("view", VIEW, "The icon the app's resolver picked.", { required: true }),
      prop("size", "IconSize", "A named icon size.", { default: '"normal"' }),
      prop("plain", "boolean", "Show the plain file icon when there is no view.", { default: "true" }),
    ],
    examples: [{ title: "In a row", code: "<FileIcon view={fileIcons.resolve(name)} />" }],
    replaces: ["src/lib/fileIcons/FileTypeIcon.svelte (resolve in the app, draw with FileIcon)"],
  },
  {
    name: "FileRow",
    group: "Navigation",
    summary: "A changed file in a list: status letter, type icon, name, dim folder, tag and hover actions.",
    usage:
      "Use in the Changes list, commit details, shelf and compare views. `checked` adds a box for lists that " +
      "pick files. Keep actions to two or three icons.",
    props: [
      prop("kind", KIND, "The change.", { required: true }),
      prop("name", "string", "The file name.", { required: true }),
      prop("directory", "string", "The folder, dim after the name.", { default: '""' }),
      prop("note", "string", "Dim text in brackets, such as the old name.", { default: '""' }),
      prop("badge", "string", "A small outlined tag, such as LFS.", { default: '""' }),
      prop("icon", VIEW, "The file's type icon.", { default: "null" }),
      prop("selected", "boolean", "The selected row.", { default: "false" }),
      prop("nested", "boolean", "Indent under a repository heading.", { default: "false" }),
      prop("variant", '"changes" | "list"', "The Changes panel's row, or a plain list of a branch's or commit's " +
        "files (no indent, selected over hover).", { default: '"changes"' }),
      prop("checked", "boolean | null", "A checkbox when not null.", { default: "null", bindable: true }),
      prop("title", "string", "Tooltip, such as the full path."),
      prop("id", "string", "Its element id, so a list can point screen readers at the selected row."),
      prop("keepFocus", "boolean", "A click leaves the focus where it was, in a list that owns the keys.", {
        default: "false",
      }),
      prop("actions", "{ icon: IconName; title: string; danger?: boolean; run: () => void }[]", "Hover actions.", {
        default: "[]",
      }),
      prop("onselect", "() => void", "Clicked."),
      prop("onactivate", "() => void", "Double-clicked or Enter."),
      prop("oncontextmenu", "(event: MouseEvent) => void", "Right-clicked, for its Menu."),
    ],
    examples: [{ title: "A change", code: '<FileRow kind="modified" name="cart.ts" directory="src" {actions} />' }],
    replaces: ["src/lib/views/changes/FileRow.svelte"],
  },
  {
    name: "SidebarRow",
    group: "Navigation",
    summary: "A sidebar row for branches, tags, stashes and worktrees, or a small-caps group heading.",
    usage: "Use in the sidebar's lists. Give `expanded` to groups; put row buttons in `actions` (shown on hover).",
    props: [
      prop("label", "string", "The name.", { required: true }),
      prop("depth", DEPTH, "Indent level, 12 px each; a row without a chevron lines up with its group's names.", {
        default: '"none"',
      }),
      prop("icon", "IconName | null", "The icon.", { default: "null" }),
      prop("current", "boolean", "The current branch: the icon in the accent color.", { default: "false" }),
      prop("strong", "boolean", "A bold name.", { default: "false" }),
      prop("section", "boolean", "A group heading in small capitals.", { default: "false" }),
      prop("expanded", "boolean | null", "Open or closed for a group; null for a leaf.", { default: "null" }),
      prop("count", "number | null", "How many items a group holds.", { default: "null", data: true }),
      prop("ahead", "number", "Commits ahead of the upstream.", { default: "0", data: true }),
      prop("behind", "number", "Commits behind the upstream.", { default: "0", data: true }),
      prop("path", "string", "A dim path after the name, such as a worktree's folder.", { default: '""', data: true }),
      prop("detail", "string", "Faint text at the end, such as a stash's ref.", { default: '""' }),
      prop("gone", "boolean", "The upstream is gone: the name struck through.", { default: "false" }),
      prop("selected", "boolean", "The selected row.", { default: "false" }),
      prop("title", "string", "Tooltip."),
      prop("actions", "Snippet", "Row buttons, shown on hover."),
      prop("onclick", "() => void", "A leaf was clicked."),
      prop("ondblclick", "() => void", "Double-clicked, such as Checkout."),
      prop("oncontextmenu", "(event: MouseEvent) => void", "Right-clicked."),
      prop("ontoggle", "() => void", "A group was opened or closed."),
    ],
    examples: [{ title: "Current branch", code: '<SidebarRow label="main" icon="branch" current ahead={2} />' }],
    replaces: ["src/lib/views/sidebar/RowContent.svelte and .sidebar-row in Sidebar.svelte"],
  },
  {
    name: "RefLabel",
    group: "Feedback",
    summary: "A ref chip in the log: HEAD, local and remote branches, tags, bisect marks and a +N chip.",
    usage: "Use in log rows and commit details. Give the full list to the +N chip's `title`.",
    props: [
      prop(
        "kind",
        '"head" | "local" | "remote" | "tag" | "more" | "bisect-bad" | "bisect-good" | "bisect-skip" | ' +
          '"bisect-current"',
        "The ref's kind and color.",
        { required: true },
      ),
      prop("label", "string", "The ref's name.", { required: true }),
      prop("title", "string", "Tooltip; defaults to the label."),
      prop("icon", "IconName | null", "A small icon before the name.", { default: "null" }),
    ],
    examples: [
      { title: "Branches", code: '<RefLabel kind="head" label="main" />\n<RefLabel kind="tag" label="v1.0" />' },
    ],
    replaces: ['<span class="ref ref-...">, <span class="ref bisect-..."> in LogView.svelte'],
  },
  {
    name: "StatusIcon",
    group: "Feedback",
    summary: "An agent's or task's state: spinner, question mark, check, square or ring.",
    usage: "Use beside an agent's name in panels and tabs. `label` is read aloud and shown as the tooltip.",
    props: [
      prop("state", '"starting" | "working" | "waiting" | "done" | "exited" | "idle"', "The state.", {
        required: true,
      }),
      prop("label", "string", "The state in words, such as Needs you.", { required: true }),
    ],
    examples: [{ title: "Working", code: '<StatusIcon state="working" label="Working" />' }],
    replaces: ["src/lib/ai/AgentStateIcon.svelte"],
  },
];
