import { prop, type ComponentDoc } from "./types";

const VIEW_HEIGHT = '"fill" | "small" | "medium" | "large"';

export const viewDocs: ComponentDoc[] = [
  {
    name: "MarkdownView",
    group: "Editor",
    summary: "Rendered Markdown in the app's preview typography: headings, lists, tasks, tables, code, quotes.",
    usage:
      "Use for Markdown previews and read-only notes. The library renders with markdown-it and sanitizes the " +
      "HTML; the app passes its own engine (highlighting, mermaid, local images) as `render`.",
    aliases: ["Markdown", "Preview", "Prose"],
    props: [
      prop("source", "string", "The Markdown text.", { required: true, data: true }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("render", "(source: string) => string", "Turns the source into safe HTML instead of the built-in one."),
      prop("variant", '"document" | "notes"', "A document's typography, or release notes' (smaller).", {
        default: '"document"',
      }),
      prop("ontoggle", "(line: number) => void", "A task box was clicked: edit that source line (0-based)."),
      prop("onlink", "(href: string) => void", "A link was clicked; without it the browser follows the link."),
    ],
    logic: ["markdownTasks.ts"],
    examples: [{ title: "A README", code: '<MarkdownView label="README.md" source={text} />' }],
    replaces: ["src/lib/views/files/MarkdownPreview.svelte", "the .md-body styles of src/lib/markdown/body.css"],
    rules: [
      "`render` must return sanitized HTML.",
      "Task boxes never change on their own: toggle the source line in `ontoggle` and pass the new source.",
    ],
  },
  {
    name: "FormatToolbar",
    group: "Editor",
    summary: "A row of formatting buttons above a text, in groups split by thin lines.",
    usage: "Use above a rich or Markdown editor. `null` in `items` starts a new group; a menu tool opens a Menu.",
    aliases: ["Toolbar", "Formatting"],
    props: [
      prop("items", "(FormatTool | null)[] ({ id; icon; label; disabled?; menu? })", "The tools in order.", {
        required: true,
      }),
      prop("label", "string", "Accessible name.", { required: true }),
      prop("onaction", "(id: string, element: HTMLElement) => void",
        "A tool was pressed; the element anchors a menu.", { required: true }),
    ],
    examples: [
      {
        title: "Markdown",
        code: '<FormatToolbar label="Format" items={[bold, italic, null, link]} onaction={format} />',
      },
    ],
    replaces: ["src/lib/views/files/MarkdownToolbar.svelte"],
  },
  {
    name: "MediaView",
    group: "Editor",
    summary: "A file that is not text: an image with zoom controls, a PDF, or a card for any other file.",
    usage:
      "Use for files that are not text. Images sit on a checkerboard so transparency shows; the bar zooms out " +
      "and in, fits or shows 100%, and Cmd + wheel zooms. Put Reveal in Finder in `actions`. For two versions " +
      "side by side use MediaCompare.",
    aliases: ["Image", "Preview", "Binary"],
    props: [
      prop("kind", '"image" | "pdf" | "binary"', "What to show.", { required: true }),
      prop("src", "string", "The file's URL (images and PDFs).", { default: '""', data: true }),
      prop("name", "string", "The file name, also the image's alt text.", { required: true }),
      prop("info", "string", "Size and type; images add their dimensions.", { default: '""', data: true }),
      prop("message", "string", "Shown instead of the file, such as Loading... or an error.", { default: '""' }),
      prop("zoom", "number | null", "The zoom; null fits the view.", { default: "null", bindable: true, data: true }),
      prop("actions", "Snippet", "Buttons at the bar's end, such as Reveal in Finder."),
    ],
    examples: [{ title: "An image", code: '<MediaView kind="image" name="logo.png" src={url} info="18 KB" />' }],
    logic: ["zoom.ts"],
    replaces: ["src/lib/views/files/MediaPreview.svelte"],
  },
  {
    name: "TerminalView",
    group: "Editor",
    summary: "A terminal screen: xterm.js in the theme's terminal colors, with starting and failed states.",
    usage:
      "Use to show a shell. It runs none: write output to the terminal given to `onready`, send `oninput` to " +
      "the shell and `onresize` to its size. Put the find bar and other overlays in `children`. A user's font " +
      "size setting is applied to the terminal in `onready`.",
    aliases: ["Terminal", "Console", "xterm"],
    props: [
      prop("label", "string", "Accessible name of the input.", { required: true }),
      prop("height", VIEW_HEIGHT, "Fill the parent, or 160, 240 or 360 px.", { default: '"fill"' }),
      prop("status", '"starting" | "ready" | "failed"', "Starting shows a spinner, failed a message.", {
        default: '"ready"',
      }),
      prop("message", "string", "The starting or failed text.", { default: '""' }),
      prop("detail", "string", "Why it failed, selectable.", { default: '""' }),
      prop("textSize", '"code" | "codeSmall"', "The font size: 13 or 12.5 px.", { default: '"code"' }),
      prop("ligatures", "boolean", "Join ligatures (=>, !=) in fonts that have them.", { default: "false" }),
      prop("dropTarget", "boolean", "Files are dragged over it: an accent outline.", { default: "false" }),
      prop("bell", "number", "A bell counter; each new value flashes the screen once.", { default: "0", data: true }),
      prop("onready", "(terminal: Terminal) => void", "The xterm Terminal, once it is open."),
      prop("oninput", "(data: string) => void", "Keys typed, to send to the shell."),
      prop("onresize", "(size: { cols: number; rows: number }) => void", "The grid size changed."),
      prop("onretry", "() => void", "Shows Retry in the failed state."),
      prop("children", "Snippet", "Overlays such as the find bar."),
    ],
    examples: [
      {
        title: "A shell",
        code: '<TerminalView label="Terminal" onready={(t) => connect(t)} oninput={send} onresize={resize} />',
      },
    ],
    replaces: ["src/lib/terminal/TerminalView.svelte frame and states"],
    rules: ["Colors come from the --term-* tokens; never pass an xterm theme."],
  },
  {
    name: "AppShell",
    group: "Layout",
    summary: "The window layout: header, activity bars, resizable side panels, editor area, bottom panel, status bar.",
    usage:
      "Use once per window. Each region is a snippet; leave one out to hide it. Panel sizes are data the user " +
      "drags, bound so the app can store them; the editor area keeps its minimum width and height.",
    aliases: ["Layout", "Workspace", "Window"],
    props: [
      prop("look", '"flat" | "rounded"', "Lines between panels, or rounded panels on the window color.", {
        default: '"flat"',
      }),
      prop("height", VIEW_HEIGHT, "Fill the parent, or 160, 240 or 360 px.", { default: '"fill"' }),
      prop("sidebarWidth", "number", "The left panel's width.", { default: "260", bindable: true, data: true }),
      prop("rightWidth", "number", "The right panel's width.", { default: "260", bindable: true, data: true }),
      prop("bottomHeight", "number", "The bottom panel's height.", { default: "260", bindable: true, data: true }),
      prop("sidebarLabel", "string", "The left handle's name.", { default: '"Resize sidebar"' }),
      prop("rightLabel", "string", "The right handle's name.", { default: '"Resize right sidebar"' }),
      prop("bottomLabel", "string", "The bottom handle's name.", { default: '"Resize bottom panel"' }),
      prop("oncommit", "() => void", "A drag ended: store the sizes."),
      prop("header", "Snippet", "The top bar."),
      prop("banners", "Snippet", "Notices under the header."),
      prop("leftBar", "Snippet", "The left ActivityBar."),
      prop("sidebar", "Snippet", "The left panel."),
      prop("editor", "Snippet", "The editor area.", { required: true }),
      prop("bottom", "Snippet", "The bottom panel, such as the terminal."),
      prop("right", "Snippet", "The right panel."),
      prop("rightBar", "Snippet", "The right ActivityBar."),
      prop("statusBar", "Snippet", "The StatusBar."),
    ],
    examples: [
      {
        title: "The window",
        code: "<AppShell bind:sidebarWidth {editor} {sidebar} {statusBar} oncommit={save} />",
      },
    ],
    logic: ["shellLayout.ts"],
    replaces: ["the layout and styles of src/lib/views/Workspace.svelte"],
  },
];
