import { prop, type ComponentDoc } from "./types";

export const shellDocs: ComponentDoc[] = [
  {
    name: "SplitPane",
    group: "Layout",
    summary: "Two panes side by side or stacked, with a ResizeHandle between; `size` is the first pane's px.",
    usage: "Use for a sidebar and an editor, or an editor and a bottom panel. Save `size` in oncommit.",
    aliases: ["Resizable", "Splitter"],
    props: [
      prop("direction", '"row" | "column"', "Side by side or one above the other.", { default: '"row"' }),
      prop("size", "number", "The first pane's width (row) or height (column) in px.", {
        required: true,
        bindable: true,
      }),
      prop("min", "number", "Smallest size.", { default: "120" }),
      prop("max", "number", "Largest size.", { default: "800" }),
      prop("defaultSize", "number", "Size after a double-click on the handle.", { default: "260" }),
      prop("label", "string", "Accessible name of the handle, e.g. `Resize the sidebar`.", { required: true }),
      prop("oncommit", "(size: number) => void", "Called once when a drag or key press ends, to save the size."),
      prop("first", "Snippet", "The first pane.", { required: true }),
      prop("second", "Snippet", "The second pane; it takes the rest.", { required: true }),
    ],
    examples: [
      {
        title: "Sidebar",
        code:
          '<SplitPane label="Resize the sidebar" bind:size>\n  {#snippet first()}<Files />{/snippet}\n' +
          "  {#snippet second()}<Editor />{/snippet}\n</SplitPane>",
      },
    ],
    logic: ["resize.ts"],
    replaces: ["Workspace.svelte's sidebar and editor columns with a ResizeHandle"],
  },
  {
    name: "ResizeHandle",
    group: "Layout",
    summary: "A drag handle on a panel's edge: a line that becomes an accent bar on hover; keys and double-click.",
    usage: "Use beside a panel whose size the parent keeps. SplitPane wraps it for the common two-pane case.",
    aliases: ["Resizable handle"],
    props: [
      prop("size", "number", "The panel's current width, or height for the bottom side.", { required: true }),
      prop("side", '"left" | "right" | "bottom"', "Where the panel is, relative to the handle.", { required: true }),
      prop("min", "number", "Smallest size.", { required: true }),
      prop("max", "number", "Largest size.", { required: true }),
      prop("defaultSize", "number", "Size after a double-click.", { required: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("onresize", "(size: number) => void", "The new size while dragging or on a key.", { required: true }),
      prop("oncommit", "(size: number) => void", "Called once when it ends, to save the size."),
    ],
    examples: [
      {
        title: "Left panel",
        code: '<ResizeHandle {size} side="left" min={160} max={600} defaultSize={260} label="Resize Files"\n' +
          "  onresize={(next) => (size = next)} oncommit={save} />",
      },
    ],
    logic: ["resize.ts"],
    replaces: ["src/lib/ui/ResizeHandle.svelte (panel becomes side, onResize becomes onresize)"],
  },
  {
    name: "StatusBar",
    group: "Layout",
    summary: "The bottom status bar: StatusItems on the left (repository, branch) and on the right.",
    usage: "Use once per window at the bottom. Put StatusItems in `start` and `end`.",
    props: [
      prop("label", "string", "Accessible name.", { default: '"Status bar"' }),
      prop("start", "Snippet", "Items on the left."),
      prop("end", "Snippet", "Items on the right."),
    ],
    examples: [
      {
        title: "Branch and memory",
        code:
          "<StatusBar>\n  {#snippet start()}<StatusItem icon=\"branch\" text=\"main\" onclick={pick} />{/snippet}\n" +
          '  {#snippet end()}<StatusItem icon="memory" text="181 MB" />{/snippet}\n</StatusBar>',
      },
    ],
    replaces: ['<footer class="status-bar"> in StatusBar.svelte'],
  },
  {
    name: "StatusItem",
    group: "Layout",
    summary: "One status bar item: an icon and short text; a button when it has `onclick`.",
    usage: "Use inside StatusBar. Keep the text to a word or two; put details in a Popover.",
    props: [
      prop("text", "string", "Short text after the icon.", { default: '""' }),
      prop("icon", "IconName | null", "The icon.", { default: "null" }),
      prop("label", "string", "Accessible name when the text alone is not enough."),
      prop("title", "string", "Tooltip."),
      prop("tone", '"default" | "accent" | "warning" | "danger"', "Color, e.g. danger for conflicts.", {
        default: '"default"',
      }),
      prop("open", "boolean", "Highlighted while its popover shows.", { default: "false" }),
      prop("onclick", "(event: MouseEvent) => void", "Makes it a button."),
    ],
    examples: [{ title: "Branch", code: '<StatusItem icon="branch" text="main" onclick={openBranches} />' }],
    replaces: ['<button class="item"> in StatusBar.svelte'],
  },
  {
    name: "ActivityBar",
    group: "Layout",
    summary: "The vertical icon bar beside a side panel; the open panel is tinted with an accent line.",
    usage: "Use at the window's left or right edge. A `null` item pushes the rest to the bottom.",
    aliases: ["Sidebar"],
    props: [
      prop("items", "({ id: string; icon: IconName; label: string; badge?: number } | null)[]", "The panels.", {
        required: true,
      }),
      prop("active", "string | null", "The open panel's id.", { default: "null", bindable: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("side", '"left" | "right"', "Which window edge; moves the border and accent line.", {
        default: '"left"',
      }),
      prop("onselect", "(id: string) => void", "A panel button was clicked."),
    ],
    examples: [{ title: "Left bar", code: '<ActivityBar label="Side panels" {items} bind:active />' }],
    replaces: ['<nav class="activity"> in ActivityBar.svelte and RightActivityBar.svelte'],
  },
];
