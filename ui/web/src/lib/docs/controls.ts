import { prop, type ComponentDoc } from "./types";

const TONE = '"accent" | "success" | "warning" | "danger"';

export const controlDocs: ComponentDoc[] = [
  {
    name: "ChoiceMenu",
    group: "Overlays",
    summary: "A menu of one-of choices in a Popover: a title with its status, then radio choices and descriptions.",
    usage: "Use for a status bar setting with a few modes, such as Keep Awake. Arrow keys move, Enter picks.",
    aliases: ["Radio menu", "Mode picker"],
    props: [
      prop("title", "string", "The bold heading.", { required: true }),
      prop("status", "string", "The current state, dim on the right.", { default: '""' }),
      prop("choices", "{ value; label; description? }[]", "The modes.", { required: true }),
      prop("value", "T", "The chosen mode.", { required: true, bindable: true }),
      prop("onchange", "(value: T) => void", "A mode was picked."),
    ],
    examples: [{ title: "Keep Awake", code: '<ChoiceMenu title="Keep Awake" status="Off" {choices} bind:value />' }],
    replaces: [".menu in src/lib/ai/KeepAwake.svelte"],
  },
  {
    name: "DialogHead",
    group: "Overlays",
    summary: "A dialog's head with more than a title: an icon on a tinted tile, a subtitle and a close button.",
    usage: "Dialog draws it from its icon, subtitle and panel variant; use it alone only in a custom dialog.",
    aliases: ["Dialog header"],
    props: [
      prop("title", "string", "The title.", { required: true }),
      prop("titleId", "string", "The heading's id, for aria-labelledby."),
      prop("subtitle", "string", "A dim line under the title.", { default: '""' }),
      prop("icon", "IconName | null", "An icon on a tinted tile.", { default: "null" }),
      prop("iconTone", TONE, "The tile's color.", { default: '"accent"' }),
      prop("size", '"normal" | "panel" | "content"', "A normal dialog's head, a panel dialog's, or a split " +
        "dialog's content head (Settings).", { default: '"normal"' }),
      prop("onclose", "() => void", "Shows a close button (without an icon)."),
    ],
    examples: [
      { title: "Update", code: '<DialogHead icon="cloud-download" title="Update available" subtitle="0.2.0" />' },
    ],
    replaces: [".head in AskpassDialog, UpdateDialog, WhatsNewDialog, ShortcutsDialog, McpToolsDialog"],
  },
  {
    name: "ZoomBar",
    group: "Editor",
    summary: "An image preview's zoom controls: out, the zoom in percent, in, Fit and 100%.",
    usage: "MediaView and MediaCompare draw it; `zoom` is null while the image fits, `fitted` is that zoom.",
    aliases: ["Zoom"],
    props: [
      prop("zoom", "number | null", "The zoom; null fits.", { default: "null", bindable: true, data: true }),
      prop("fitted", "number", "The fitting zoom, shown while zoom is null.", { default: "1", data: true }),
      prop("disabled", "boolean", "Before the image is measured.", { default: "false" }),
      prop("fitTitle", "string", "Fit's tooltip.", { default: '"Fit the image in the view"' }),
      prop("actualTitle", "string", "100%'s tooltip.", { default: '"Show the image at its real size"' }),
    ],
    examples: [{ title: "Zoom", code: "<ZoomBar bind:zoom {fitted} />" }],
    logic: ["zoom.ts"],
    replaces: [".bar zoom buttons in MediaPreview.svelte and BinaryPreview.svelte"],
  },
  {
    name: "ImageCanvas",
    group: "Editor",
    summary: "An image on a checkerboard, centered and scrollable, drawn at a scale of its real size.",
    usage: "MediaView and MediaCompare are built on it. It reports sizes and asks to zoom on Cmd + wheel.",
    aliases: ["Image", "Checkerboard"],
    props: [
      prop("src", "string", "The image URL.", { required: true, data: true }),
      prop("alt", "string", "The image's description.", { required: true }),
      prop("scale", "number | null", "Times the real size; null lets the browser size it.", {
        default: "null",
        data: true,
      }),
      prop("element", "HTMLDivElement | null", "The scroll box, for synced scrolling.", {
        default: "null",
        bindable: true,
      }),
      prop("onmeasure", "(natural, box) => void", "The image's real size and the box's size."),
      prop("onzoom", "(direction: 1 | -1) => void", "Cmd or Ctrl + wheel, or a pinch."),
      prop("onscroll", "() => void", "The box scrolled."),
      prop("onerror", "() => void", "The image could not load."),
    ],
    examples: [{ title: "Canvas", code: '<ImageCanvas src={url} alt="logo" scale={zoom} />' }],
    logic: ["zoom.ts"],
    replaces: [".canvas in MediaPreview.svelte and BinaryPreview.svelte"],
  },
  {
    name: "MediaCompare",
    group: "Editor",
    summary: "Two versions of an image or PDF side by side, with one shared zoom and synced scrolling.",
    usage: "Use for a binary file's change. A side without a file shows its message, such as Added here.",
    aliases: ["Image diff", "Binary diff"],
    props: [
      prop("sides", "[side, side] ({ label; kind: image|pdf|none; src?; info?; message? })", "Old and new.", {
        required: true,
        data: true,
      }),
      prop("zoom", "number | null", "The shared zoom; null fits both.", {
        default: "null",
        bindable: true,
        data: true,
      }),
      prop("onerror", "(side: number) => void", "An image could not load (0 old, 1 new): pass that side a message."),
    ],
    examples: [{ title: "A logo change", code: "<MediaCompare sides={[before, after]} bind:zoom />" }],
    logic: ["zoom.ts"],
    replaces: ["src/lib/diff/BinaryPreview.svelte"],
  },
];
